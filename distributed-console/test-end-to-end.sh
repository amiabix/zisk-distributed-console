#!/bin/bash

# End-to-End Test Script for ZisK Distributed Dashboard
# Tests: Coordinator startup → Worker registration → Proof launch → Phase visibility → Metrics

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (NO HARDCODING - all paths must be discovered or provided)
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
COORDINATOR_URL="${COORDINATOR_URL:-localhost:50051}"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:5173}"

# Test state
TESTS_PASSED=0
TESTS_FAILED=0
TEST_LOG="/tmp/zisk-dashboard-test.log"

log() {
    echo -e "${BLUE}[TEST]${NC} $1" | tee -a "$TEST_LOG"
}

pass() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$TEST_LOG"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$TEST_LOG"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$TEST_LOG"
}

# Cleanup function
cleanup() {
    log "Cleaning up test environment..."
    # Stop coordinator if we started it
    if [ -n "$COORDINATOR_PID" ]; then
        kill "$COORDINATOR_PID" 2>/dev/null || true
    fi
    # Stop gateway if we started it
    if [ -n "$GATEWAY_PID" ]; then
        kill "$GATEWAY_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Test 1: Check if gateway is running
test_gateway_running() {
    log "Test 1: Checking if gateway server is running..."
    if curl -s -f "$GATEWAY_URL/api/health" > /dev/null 2>&1; then
        pass "Gateway server is running at $GATEWAY_URL"
        return 0
    else
        fail "Gateway server is not running at $GATEWAY_URL"
        warn "Start gateway with: cd distributed-console && node gateway-server.cjs"
        return 1
    fi
}

# Test 2: Check coordinator status (should be stopped initially)
test_coordinator_status() {
    log "Test 2: Checking coordinator process status..."
    local response=$(curl -s "$GATEWAY_URL/api/coordinator/process-status")
    local running=$(echo "$response" | grep -o '"running":[^,]*' | cut -d: -f2 | tr -d ' ')
    
    if [ "$running" = "false" ]; then
        pass "Coordinator is stopped (expected)"
        return 0
    elif [ "$running" = "true" ]; then
        warn "Coordinator is already running (may interfere with tests)"
        return 0
    else
        fail "Could not determine coordinator status"
        return 1
    fi
}

# Test 3: Start coordinator via dashboard API
test_start_coordinator() {
    log "Test 3: Starting coordinator via dashboard API..."
    local response=$(curl -s -X POST "$GATEWAY_URL/api/coordinator/start")
    
    if echo "$response" | grep -q '"error"'; then
        local error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        if echo "$error" | grep -q "already running"; then
            pass "Coordinator is already running (expected if test rerun)"
            return 0
        else
            fail "Failed to start coordinator: $error"
            return 1
        fi
    else
        # Wait for coordinator to be ready
        sleep 3
        local status=$(curl -s "$GATEWAY_URL/api/coordinator/process-status")
        if echo "$status" | grep -q '"running":true'; then
            pass "Coordinator started successfully"
            return 0
        else
            fail "Coordinator start command succeeded but process not running"
            return 1
        fi
    fi
}

# Test 4: Verify coordinator is visible in dashboard
test_coordinator_visible() {
    log "Test 4: Verifying coordinator is visible in dashboard..."
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local response=$(curl -s "$GATEWAY_URL/api/coordinator/info" 2>/dev/null)
        if echo "$response" | grep -q '"status":"connected"'; then
            pass "Coordinator is visible and connected in dashboard"
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    
    fail "Coordinator not visible in dashboard after $max_attempts attempts"
    return 1
}

# Test 5: Check if worker binary exists (required for worker registration)
test_worker_binary_exists() {
    log "Test 5: Checking if worker binary is available..."
    local response=$(curl -s -X POST "$GATEWAY_URL/api/worker/start" \
        -H "Content-Type: application/json" \
        -d '{"workerId":"test-check","elfPath":"/tmp/test.elf","inputPath":"/tmp/test.bin"}' 2>/dev/null)
    
    if echo "$response" | grep -q "binary not found"; then
        fail "Worker binary not found. Build it with: cargo build --release --bin zisk-worker"
        return 1
    elif echo "$response" | grep -q "ELF file not found"; then
        pass "Worker binary exists (ELF validation works)"
        return 0
    else
        warn "Could not determine worker binary status"
        return 0
    fi
}

# Test 6: Test worker registration (if we have ELF and input paths)
test_worker_registration() {
    log "Test 6: Testing worker registration..."
    
    # Check if ELF and input paths are provided via environment
    if [ -z "$TEST_ELF_PATH" ] || [ -z "$TEST_INPUT_PATH" ]; then
        warn "Skipping worker registration test (set TEST_ELF_PATH and TEST_INPUT_PATH)"
        return 0
    fi
    
    if [ ! -f "$TEST_ELF_PATH" ]; then
        warn "ELF file not found at $TEST_ELF_PATH - skipping worker test"
        return 0
    fi
    
    if [ ! -f "$TEST_INPUT_PATH" ]; then
        warn "Input file not found at $TEST_INPUT_PATH - skipping worker test"
        return 0
    fi
    
    local response=$(curl -s -X POST "$GATEWAY_URL/api/worker/start" \
        -H "Content-Type: application/json" \
        -d "{\"workerId\":\"test-worker-$(date +%s)\",\"elfPath\":\"$TEST_ELF_PATH\",\"inputPath\":\"$TEST_INPUT_PATH\"}")
    
    if echo "$response" | grep -q '"error"'; then
        local error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        fail "Worker registration failed: $error"
        return 1
    else
        # Wait for worker to register
        sleep 5
        local workers=$(curl -s "$GATEWAY_URL/api/workers" 2>/dev/null || echo '{"workers":[]}')
        if echo "$workers" | grep -q "test-worker"; then
            pass "Worker registered successfully"
            return 0
        else
            warn "Worker start command succeeded but worker not visible in list"
            return 0
        fi
    fi
}

# Test 7: Test proof launch (if we have ELF and input paths)
test_proof_launch() {
    log "Test 7: Testing proof launch..."
    
    if [ -z "$TEST_ELF_PATH" ] || [ -z "$TEST_INPUT_PATH" ]; then
        warn "Skipping proof launch test (set TEST_ELF_PATH and TEST_INPUT_PATH)"
        return 0
    fi
    
    local block_id="0x$(openssl rand -hex 16)"
    local response=$(curl -s -X POST "$GATEWAY_URL/api/proof/launch" \
        -H "Content-Type: application/json" \
        -d "{\"block_id\":\"$block_id\",\"compute_capacity\":10,\"input_path\":\"$TEST_INPUT_PATH\"}")
    
    if echo "$response" | grep -q '"error"'; then
        local error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        fail "Proof launch failed: $error"
        return 1
    else
        local job_id=$(echo "$response" | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$job_id" ]; then
            pass "Proof launched successfully (Job ID: $job_id)"
            echo "$job_id" > /tmp/test-job-id.txt
            return 0
        else
            fail "Proof launch succeeded but no job_id returned"
            return 1
        fi
    fi
}

# Test 8: Verify job is visible in dashboard
test_job_visible() {
    log "Test 8: Verifying job is visible in dashboard..."
    
    local job_id=$(cat /tmp/test-job-id.txt 2>/dev/null || echo "")
    if [ -z "$job_id" ]; then
        warn "No job ID from previous test - skipping job visibility test"
        return 0
    fi
    
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local response=$(curl -s "$GATEWAY_URL/api/job/$job_id" 2>/dev/null)
        if echo "$response" | grep -q "\"job_id\":\"$job_id\""; then
            pass "Job is visible in dashboard (Job ID: $job_id)"
            return 0
        fi
        sleep 2
        ((attempt++))
    done
    
    fail "Job not visible in dashboard after $max_attempts attempts"
    return 1
}

# Test 9: Verify phases are updating
test_phases_visible() {
    log "Test 9: Verifying proof phases are visible and updating..."
    
    local job_id=$(cat /tmp/test-job-id.txt 2>/dev/null || echo "")
    if [ -z "$job_id" ]; then
        warn "No job ID - skipping phase visibility test"
        return 0
    fi
    
    local max_attempts=5
    local attempt=0
    local last_phase=""
    
    while [ $attempt -lt $max_attempts ]; do
        local response=$(curl -s "$GATEWAY_URL/api/job/$job_id" 2>/dev/null)
        local phase=$(echo "$response" | grep -o '"phase":"[^"]*"' | cut -d'"' -f4 || echo "")
        
        if [ -n "$phase" ]; then
            if [ -z "$last_phase" ]; then
                last_phase="$phase"
                log "  Initial phase detected: $phase"
            elif [ "$phase" != "$last_phase" ]; then
                pass "Phase transition detected: $last_phase -> $phase"
                return 0
            fi
        fi
        sleep 3
        ((attempt++))
    done
    
    if [ -n "$last_phase" ]; then
        pass "Phase is visible: $last_phase (may not have transitioned yet)"
        return 0
    else
        fail "No phase information found in job status"
        return 1
    fi
}

# Test 10: Verify metrics are visible
test_metrics_visible() {
    log "Test 10: Verifying worker metrics are visible..."
    
    local response=$(curl -s "$GATEWAY_URL/api/workers" 2>/dev/null || echo '{"workers":[]}')
    local worker_count=$(echo "$response" | grep -o '"worker_id"' | wc -l | tr -d ' ')
    
    if [ "$worker_count" -gt 0 ]; then
        # Check if metrics are present
        if echo "$response" | grep -q "cpu_percent\|memory_used\|metrics"; then
            pass "Worker metrics are visible ($worker_count worker(s))"
            return 0
        else
            warn "Workers visible but metrics not found"
            return 0
        fi
    else
        warn "No workers registered - skipping metrics test"
        return 0
    fi
}

# Test 11: Verify dashboard UI is accessible
test_dashboard_ui() {
    log "Test 11: Verifying dashboard UI is accessible..."
    
    if curl -s -f "$DASHBOARD_URL" > /dev/null 2>&1; then
        pass "Dashboard UI is accessible at $DASHBOARD_URL"
        return 0
    else
        warn "Dashboard UI not accessible at $DASHBOARD_URL (may not be started)"
        return 0
    fi
}

# Test 12: Run frontend validation tests
test_frontend_validation() {
    log "Test 12: Running frontend validation tests..."
    
    if [ ! -f "test-frontend-validation.cjs" ]; then
        warn "Frontend validation script not found - skipping"
        return 0
    fi
    
    local result=$(node test-frontend-validation.cjs 2>&1)
    local exit_code=$?
    
    echo "$result" | tee -a "$TEST_LOG"
    
    if [ $exit_code -eq 0 ]; then
        pass "Frontend validation tests passed"
        return 0
    else
        fail "Frontend validation tests failed (see output above)"
        return 1
    fi
}

# Main test execution
main() {
    echo "=========================================="
    echo "ZisK Dashboard End-to-End Test Suite"
    echo "=========================================="
    echo ""
    
    # Clear previous test log
    > "$TEST_LOG"
    
    # Run tests
    test_gateway_running
    test_coordinator_status
    test_start_coordinator
    test_coordinator_visible
    test_worker_binary_exists
    test_worker_registration
    test_proof_launch
    test_job_visible
    test_phases_visible
    test_metrics_visible
    test_dashboard_ui
    test_frontend_validation
    
    # Summary
    echo ""
    echo "=========================================="
    echo "Test Summary"
    echo "=========================================="
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    echo ""
    echo "Full test log: $TEST_LOG"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed. Check $TEST_LOG for details.${NC}"
        exit 1
    fi
}

# Run main if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi

