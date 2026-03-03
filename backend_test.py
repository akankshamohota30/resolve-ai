#!/usr/bin/env python3
"""
Backend API Test Suite for Amazon AI Support Hub

Tests the following endpoints:
- POST /api/chat (AI keyword detection and response generation)
- POST /api/action/confirm (action confirmations)
- GET /api/metrics (metrics retrieval)
- POST /api/rating (rating submission)
"""

import requests
import json
import time
from typing import Dict, Any, List

# Backend URL from environment
BACKEND_URL = "https://instant-support-hub.preview.emergentagent.com/api"

def test_api_endpoint(method: str, endpoint: str, data: Dict = None) -> Dict[str, Any]:
    """Test an API endpoint and return response details"""
    url = f"{BACKEND_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=30)
        else:
            return {"success": False, "error": f"Unsupported method: {method}"}
        
        return {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "response": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text,
            "error": None if response.status_code == 200 else f"HTTP {response.status_code}"
        }
    
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timeout (30s)"}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Connection error - backend may be down"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"Request error: {str(e)}"}
    except json.JSONDecodeError:
        return {"success": False, "error": "Invalid JSON response"}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}

def test_chat_endpoint():
    """Test POST /api/chat with various keyword scenarios"""
    print("\n" + "="*60)
    print("TESTING: POST /api/chat - AI Keyword Detection")
    print("="*60)
    
    test_messages = [
        {
            "scenario": "Missing Package Detection",
            "message": "I didn't receive my package",
            "expected_intent": "missing_package",
            "expected_action": "refund_confirm"
        },
        {
            "scenario": "Return Request Detection", 
            "message": "I want to return an item",
            "expected_intent": "return",
            "expected_action": None
        },
        {
            "scenario": "Order Tracking Detection",
            "message": "Track my order",
            "expected_intent": "track", 
            "expected_action": None
        },
        {
            "scenario": "Cancel Order Detection",
            "message": "Cancel my order",
            "expected_intent": "cancel",
            "expected_action": "cancel_confirm"
        },
        {
            "scenario": "Change Address Detection",
            "message": "Change my delivery address",
            "expected_intent": "change_address",
            "expected_action": "address_form"
        },
        {
            "scenario": "Other Intent Detection",
            "message": "I have a question",
            "expected_intent": "other",
            "expected_action": None
        }
    ]
    
    results = []
    
    for test in test_messages:
        print(f"\n📝 Testing: {test['scenario']}")
        print(f"   Input: \"{test['message']}\"")
        
        payload = {
            "text": test["message"],
            "sender": "user",
            "message_type": "text"
        }
        
        result = test_api_endpoint("POST", "/chat", payload)
        
        if result["success"]:
            response = result["response"]
            detected_intent = response.get("intent", "")
            detected_action = response.get("action_type", None)
            messages = response.get("messages", [])
            
            # Verify intent detection
            intent_correct = detected_intent == test["expected_intent"]
            action_correct = detected_action == test["expected_action"]
            
            print(f"   ✅ Status: HTTP 200")
            print(f"   📊 Intent: {detected_intent} {'✅' if intent_correct else '❌'}")
            print(f"   🔧 Action: {detected_action} {'✅' if action_correct else '❌'}")
            print(f"   💬 Messages: {len(messages)} returned")
            
            # Log first message content for verification
            if messages:
                first_msg = messages[0].get("text", "")
                print(f"   📄 First Message: {first_msg[:100]}...")
            
            results.append({
                "scenario": test["scenario"],
                "success": True,
                "intent_correct": intent_correct,
                "action_correct": action_correct,
                "message_count": len(messages)
            })
        else:
            print(f"   ❌ FAILED: {result['error']}")
            results.append({
                "scenario": test["scenario"],
                "success": False,
                "error": result["error"]
            })
    
    # Summary
    successful_tests = sum(1 for r in results if r["success"])
    print(f"\n📊 CHAT ENDPOINT SUMMARY: {successful_tests}/{len(test_messages)} tests passed")
    
    return results

def test_action_confirm_endpoint():
    """Test POST /api/action/confirm endpoint"""
    print("\n" + "="*60)
    print("TESTING: POST /api/action/confirm - Action Confirmations")
    print("="*60)
    
    test_actions = [
        {
            "scenario": "Refund Confirmation",
            "payload": {
                "action_type": "refund_confirm",
                "order_id": "TEST-123456",
                "metadata": {"amount": 2499}
            }
        },
        {
            "scenario": "Cancel Confirmation",
            "payload": {
                "action_type": "cancel_confirm", 
                "order_id": "TEST-789012",
                "metadata": {"amount": 3299}
            }
        },
        {
            "scenario": "Address Updated",
            "payload": {
                "action_type": "address_updated",
                "metadata": {
                    "street": "123 Test Street",
                    "city": "Mumbai",
                    "pin": "400001"
                }
            }
        }
    ]
    
    results = []
    
    for test in test_actions:
        print(f"\n📝 Testing: {test['scenario']}")
        
        result = test_api_endpoint("POST", "/action/confirm", test["payload"])
        
        if result["success"]:
            response = result["response"]
            message = response.get("message", {})
            show_rating = response.get("show_rating", False)
            
            print(f"   ✅ Status: HTTP 200")
            print(f"   💬 Message: {message.get('text', '')}")
            print(f"   ⭐ Show Rating: {show_rating}")
            
            results.append({
                "scenario": test["scenario"],
                "success": True,
                "shows_rating": show_rating
            })
        else:
            print(f"   ❌ FAILED: {result['error']}")
            results.append({
                "scenario": test["scenario"],
                "success": False,
                "error": result["error"]
            })
    
    successful_tests = sum(1 for r in results if r["success"])
    print(f"\n📊 ACTION CONFIRM SUMMARY: {successful_tests}/{len(test_actions)} tests passed")
    
    return results

def test_metrics_endpoint():
    """Test GET /api/metrics endpoint"""
    print("\n" + "="*60)
    print("TESTING: GET /api/metrics - Metrics Retrieval")
    print("="*60)
    
    result = test_api_endpoint("GET", "/metrics")
    
    if result["success"]:
        metrics = result["response"]
        expected_fields = ["ai_resolutions", "avg_resolution_time", "csat_score", "cost_saved"]
        
        print("   ✅ Status: HTTP 200")
        print("   📊 Metrics Retrieved:")
        
        all_fields_present = True
        for field in expected_fields:
            value = metrics.get(field)
            field_present = field in metrics
            all_fields_present = all_fields_present and field_present
            
            print(f"     • {field}: {value} {'✅' if field_present else '❌'}")
        
        return {
            "success": True,
            "all_fields_present": all_fields_present,
            "metrics": metrics
        }
    else:
        print(f"   ❌ FAILED: {result['error']}")
        return {
            "success": False,
            "error": result["error"]
        }

def test_rating_endpoint():
    """Test POST /api/rating endpoint"""
    print("\n" + "="*60)
    print("TESTING: POST /api/rating - Rating Submission")
    print("="*60)
    
    test_rating = {
        "conversation_id": "test-conv-123",
        "stars": 5
    }
    
    result = test_api_endpoint("POST", "/rating", test_rating)
    
    if result["success"]:
        response = result["response"]
        
        print("   ✅ Status: HTTP 200")
        print(f"   ⭐ Rating ID: {response.get('id', 'N/A')}")
        print(f"   💬 Conversation: {response.get('conversation_id', 'N/A')}")
        print(f"   ⭐ Stars: {response.get('stars', 'N/A')}")
        
        return {
            "success": True,
            "rating_id": response.get("id"),
            "stars": response.get("stars")
        }
    else:
        print(f"   ❌ FAILED: {result['error']}")
        return {
            "success": False,
            "error": result["error"]
        }

def test_metrics_increment_after_actions():
    """Test if metrics increment after action confirmations"""
    print("\n" + "="*60)
    print("TESTING: Metrics Increment After Actions")
    print("="*60)
    
    # Get initial metrics
    print("📊 Getting initial metrics...")
    initial_result = test_api_endpoint("GET", "/metrics")
    
    if not initial_result["success"]:
        print(f"   ❌ Failed to get initial metrics: {initial_result['error']}")
        return {"success": False, "error": "Could not retrieve initial metrics"}
    
    initial_resolutions = initial_result["response"].get("ai_resolutions", 0)
    initial_cost_saved = initial_result["response"].get("cost_saved", 0)
    
    print(f"   Initial AI Resolutions: {initial_resolutions}")
    print(f"   Initial Cost Saved: {initial_cost_saved}")
    
    # Perform a refund confirmation
    print("\n🔧 Performing refund confirmation...")
    refund_payload = {
        "action_type": "refund_confirm",
        "order_id": "METRICS-TEST-001",
        "metadata": {"amount": 1999}
    }
    
    confirm_result = test_api_endpoint("POST", "/action/confirm", refund_payload)
    
    if not confirm_result["success"]:
        print(f"   ❌ Action confirmation failed: {confirm_result['error']}")
        return {"success": False, "error": "Action confirmation failed"}
    
    print("   ✅ Action confirmed successfully")
    
    # Wait a moment for DB update
    time.sleep(1)
    
    # Get updated metrics
    print("\n📊 Getting updated metrics...")
    updated_result = test_api_endpoint("GET", "/metrics")
    
    if not updated_result["success"]:
        print(f"   ❌ Failed to get updated metrics: {updated_result['error']}")
        return {"success": False, "error": "Could not retrieve updated metrics"}
    
    updated_resolutions = updated_result["response"].get("ai_resolutions", 0)
    updated_cost_saved = updated_result["response"].get("cost_saved", 0)
    
    print(f"   Updated AI Resolutions: {updated_resolutions}")
    print(f"   Updated Cost Saved: {updated_cost_saved}")
    
    # Check increments
    resolutions_increased = updated_resolutions > initial_resolutions
    cost_saved_increased = updated_cost_saved > initial_cost_saved
    
    print(f"\n📈 Metrics Changes:")
    print(f"   AI Resolutions: {'+' if resolutions_increased else '='}{updated_resolutions - initial_resolutions} {'✅' if resolutions_increased else '❌'}")
    print(f"   Cost Saved: {'+' if cost_saved_increased else '='}{updated_cost_saved - initial_cost_saved} {'✅' if cost_saved_increased else '❌'}")
    
    return {
        "success": True,
        "resolutions_increased": resolutions_increased,
        "cost_saved_increased": cost_saved_increased,
        "resolutions_delta": updated_resolutions - initial_resolutions,
        "cost_saved_delta": updated_cost_saved - initial_cost_saved
    }

def run_all_tests():
    """Run all backend tests and provide summary"""
    print("🚀 AMAZON AI SUPPORT HUB - BACKEND API TESTS")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Started: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    test_results = {
        "chat_tests": test_chat_endpoint(),
        "action_confirm_tests": test_action_confirm_endpoint(),
        "metrics_test": test_metrics_endpoint(),
        "rating_test": test_rating_endpoint(),
        "metrics_increment_test": test_metrics_increment_after_actions()
    }
    
    # Final Summary
    print("\n" + "="*60)
    print("🎯 FINAL TEST SUMMARY")
    print("="*60)
    
    # Chat endpoint summary
    chat_successful = sum(1 for r in test_results["chat_tests"] if r["success"])
    chat_total = len(test_results["chat_tests"])
    print(f"📱 Chat Endpoint: {chat_successful}/{chat_total} scenarios passed")
    
    # Action confirm summary
    action_successful = sum(1 for r in test_results["action_confirm_tests"] if r["success"])
    action_total = len(test_results["action_confirm_tests"])
    print(f"🔧 Action Confirm: {action_successful}/{action_total} actions passed")
    
    # Individual endpoint status
    metrics_status = "✅ PASS" if test_results["metrics_test"]["success"] else "❌ FAIL"
    rating_status = "✅ PASS" if test_results["rating_test"]["success"] else "❌ FAIL"
    increment_status = "✅ PASS" if test_results["metrics_increment_test"]["success"] else "❌ FAIL"
    
    print(f"📊 Metrics Endpoint: {metrics_status}")
    print(f"⭐ Rating Endpoint: {rating_status}")
    print(f"📈 Metrics Increment: {increment_status}")
    
    # Overall status
    all_tests_passed = (
        chat_successful == chat_total and
        action_successful == action_total and
        test_results["metrics_test"]["success"] and
        test_results["rating_test"]["success"] and
        test_results["metrics_increment_test"]["success"]
    )
    
    overall_status = "🎉 ALL TESTS PASSED!" if all_tests_passed else "⚠️  SOME TESTS FAILED"
    print(f"\n🏆 OVERALL: {overall_status}")
    
    return test_results

if __name__ == "__main__":
    run_all_tests()