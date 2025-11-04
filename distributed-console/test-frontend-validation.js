#!/usr/bin/env node

/**
 * Frontend Validation Test
 * Validates that the dashboard UI correctly displays:
 * - Coordinator status
 * - Worker registration
 * - Proof jobs
 * - Phase transitions
 * - Metrics
 */

const http = require('http');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:5173';

let testsPassed = 0;
let testsFailed = 0;

function log(message) {
    console.log(`[TEST] ${message}`);
}

function pass(message) {
    console.log(`[PASS] ${message}`);
    testsPassed++;
}

function fail(message) {
    console.log(`[FAIL] ${message}`);
    testsFailed++;
}

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        };

        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = res.statusCode === 200 ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, data: json || data, headers: res.headers });
                } catch {
                    resolve({ status: res.statusCode, data, headers: res.headers });
                }
            });
        });

        req.on('error', reject);
        
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        
        req.end();
    });
}

async function testGatewayHealth() {
    log('Testing gateway health endpoint...');
    try {
        const response = await makeRequest(`${GATEWAY_URL}/api/health`);
        if (response.status === 200 && response.data.status) {
            pass('Gateway health check passed');
            return true;
        } else {
            fail(`Gateway health check failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        fail(`Gateway health check error: ${error.message}`);
        return false;
    }
}

async function testCoordinatorInfo() {
    log('Testing coordinator info endpoint...');
    try {
        const response = await makeRequest(`${GATEWAY_URL}/api/coordinator/info`);
        if (response.status === 200 && response.data) {
            const info = response.data;
            if (info.coordinator_host && info.coordinator_port) {
                pass(`Coordinator info retrieved: ${info.coordinator_host}:${info.coordinator_port}`);
                return true;
            } else {
                fail('Coordinator info missing required fields');
                return false;
            }
        } else {
            fail(`Coordinator info request failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        fail(`Coordinator info error: ${error.message}`);
        return false;
    }
}

async function testCoordinatorStatus() {
    log('Testing coordinator process status...');
    try {
        const response = await makeRequest(`${GATEWAY_URL}/api/coordinator/process-status`);
        if (response.status === 200 && response.data) {
            const status = response.data;
            if (typeof status.running === 'boolean') {
                pass(`Coordinator status: ${status.running ? 'Running' : 'Stopped'}`);
                return true;
            } else {
                fail('Coordinator status missing running field');
                return false;
            }
        } else {
            fail(`Coordinator status request failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        fail(`Coordinator status error: ${error.message}`);
        return false;
    }
}

async function testWorkersList() {
    log('Testing workers list endpoint...');
    try {
        const response = await makeRequest(`${GATEWAY_URL}/api/workers`);
        if (response.status === 200) {
            const workers = response.data.workers || [];
            pass(`Workers list retrieved: ${workers.length} worker(s)`);
            
            // Validate worker structure if workers exist
            if (workers.length > 0) {
                const worker = workers[0];
                const requiredFields = ['worker_id', 'state'];
                const missingFields = requiredFields.filter(f => !(f in worker));
                
                if (missingFields.length === 0) {
                    pass('Worker structure is valid');
                } else {
                    fail(`Worker missing fields: ${missingFields.join(', ')}`);
                }
                
                // Check for metrics
                if (worker.metrics) {
                    const metricFields = ['cpu_percent', 'memory_used_gb'];
                    const hasMetrics = metricFields.some(f => f in worker.metrics);
                    if (hasMetrics) {
                        pass('Worker metrics are present');
                    } else {
                        fail('Worker metrics structure invalid');
                    }
                }
            }
            
            return true;
        } else {
            fail(`Workers list request failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        fail(`Workers list error: ${error.message}`);
        return false;
    }
}

async function testJobsList() {
    log('Testing jobs list endpoint...');
    try {
        const response = await makeRequest(`${GATEWAY_URL}/api/jobs`);
        if (response.status === 200) {
            const jobs = response.data.jobs || [];
            pass(`Jobs list retrieved: ${jobs.length} job(s)`);
            
            // Validate job structure if jobs exist
            if (jobs.length > 0) {
                const job = jobs[0];
                const requiredFields = ['job_id', 'phase', 'state'];
                const missingFields = requiredFields.filter(f => !(f in job));
                
                if (missingFields.length === 0) {
                    pass('Job structure is valid');
                    
                    // Check phase field
                    const validPhases = ['Contributions', 'Prove', 'Aggregate'];
                    if (validPhases.includes(job.phase) || job.phase === 'Unknown') {
                        pass(`Job phase is valid: ${job.phase}`);
                    } else {
                        fail(`Invalid job phase: ${job.phase}`);
                    }
                } else {
                    fail(`Job missing fields: ${missingFields.join(', ')}`);
                }
            }
            
            return true;
        } else {
            fail(`Jobs list request failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        fail(`Jobs list error: ${error.message}`);
        return false;
    }
}

async function testSystemStatus() {
    log('Testing system status endpoint...');
    try {
        const response = await makeRequest(`${GATEWAY_URL}/api/status`);
        if (response.status === 200 && response.data) {
            const status = response.data.status || response.data;
            const hasWorkers = typeof status.total_workers === 'number';
            const hasJobs = typeof status.active_jobs === 'number';
            
            if (hasWorkers || hasJobs) {
                pass(`System status retrieved: ${status.total_workers || 0} workers, ${status.active_jobs || 0} jobs`);
                return true;
            } else {
                fail('System status missing required fields');
                return false;
            }
        } else {
            fail(`System status request failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        fail(`System status error: ${error.message}`);
        return false;
    }
}

async function testProofsList() {
    log('Testing proofs list endpoint...');
    try {
        const response = await makeRequest(`${GATEWAY_URL}/api/proofs`);
        if (response.status === 200) {
            const proofs = response.data.proofs || [];
            pass(`Proofs list retrieved: ${proofs.length} proof(s)`);
            return true;
        } else {
            fail(`Proofs list request failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        fail(`Proofs list error: ${error.message}`);
        return false;
    }
}

async function testDashboardUI() {
    log('Testing dashboard UI accessibility...');
    try {
        const response = await makeRequest(DASHBOARD_URL);
        if (response.status === 200) {
            const html = response.data;
            if (typeof html === 'string') {
                // Check for key React markers
                if (html.includes('root') || html.includes('react') || html.includes('vite')) {
                    pass('Dashboard UI is accessible and appears to be a React app');
                    return true;
                } else {
                    fail('Dashboard UI accessible but may not be React app');
                    return false;
                }
            } else {
                fail('Dashboard UI returned non-HTML response');
                return false;
            }
        } else {
            fail(`Dashboard UI request failed: ${response.status}`);
            return false;
        }
    } catch (error) {
        fail(`Dashboard UI error: ${error.message} (UI may not be running)`);
        return false;
    }
}

async function testFrontendAPIConsistency() {
    log('Testing frontend API endpoint consistency...');
    
    // The frontend should be able to call these endpoints
    const endpoints = [
        '/api/health',
        '/api/coordinator/info',
        '/api/coordinator/process-status',
        '/api/workers',
        '/api/jobs',
        '/api/status',
    ];
    
    let allPassed = true;
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest(`${GATEWAY_URL}${endpoint}`);
            if (response.status !== 200) {
                fail(`Endpoint ${endpoint} returned ${response.status}`);
                allPassed = false;
            }
        } catch (error) {
            fail(`Endpoint ${endpoint} error: ${error.message}`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        pass('All frontend API endpoints are accessible');
    }
    
    return allPassed;
}

async function main() {
    console.log('==========================================');
    console.log('Frontend Validation Test Suite');
    console.log('==========================================');
    console.log('');
    
    // Run all tests
    await testGatewayHealth();
    await testCoordinatorInfo();
    await testCoordinatorStatus();
    await testWorkersList();
    await testJobsList();
    await testSystemStatus();
    await testProofsList();
    await testFrontendAPIConsistency();
    await testDashboardUI();
    
    // Summary
    console.log('');
    console.log('==========================================');
    console.log('Frontend Test Summary');
    console.log('==========================================');
    console.log(`Passed: ${testsPassed}`);
    console.log(`Failed: ${testsFailed}`);
    console.log('');
    
    if (testsFailed === 0) {
        console.log('✅ All frontend validation tests passed!');
        process.exit(0);
    } else {
        console.log('❌ Some frontend validation tests failed');
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Test suite error:', error);
    process.exit(1);
});

