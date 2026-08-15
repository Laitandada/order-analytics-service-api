import http from 'k6/http';
import { check, sleep } from 'k6';

// Load pre-extracted valid order IDs from the same directory
const orderIds = JSON.parse(open('./order_ids.json'));

export const options = {
  // Simulate 200 concurrent users
  vus: 200,
  duration: '30s',
  
  // Define SLA performance thresholds
  thresholds: {
    // p95 latency must be below 50ms, p99 below 1000ms, and less than 1% of requests can fail
    http_req_duration: ['p(95)<50', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
  // Ensure k6 calculates p(99) in the trend stats
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
  if (orderIds.length === 0) {
    fail('No valid order IDs loaded. Make sure to run the prep script first.');
  }

  // Pick a random order record from the pre-seeded dataset
  const randomIndex = Math.floor(Math.random() * orderIds.length);
  const order = orderIds[randomIndex];
  const { id, orderedAt } = order;
  
  const targetHost = __ENV.TARGET_HOST || 'localhost:3000';
  const url = `http://${targetHost}/orders/${id}?orderedAt=${orderedAt}`;
  
  const res = http.get(url);
  
  // Assert response code is 200 OK
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has valid payload': (r) => r.body && r.body.includes(id),
  });

  // Short pause between requests per virtual user to simulate user behavior
  // Note: For maximum throughput/stress testing, sleep can be omitted or minimized.
  // We keep it very small (e.g. 10ms to 50ms) or omit it to truly stress the connection pool.
  sleep(0.05); // 50ms sleep
}
