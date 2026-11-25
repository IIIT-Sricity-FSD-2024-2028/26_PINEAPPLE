const fs = require('fs');
const assert = require('assert');

const appRoutesContent = fs.readFileSync('React-Implementation/React-Implementation/src/routes/AppRoutes.jsx', 'utf8');

// 1. Check canonical routes
assert(appRoutesContent.includes('path="/owner/mentors"'), 'Canonical /owner/mentors route must exist');
assert(appRoutesContent.includes('path="/mentor/apply"'), 'Canonical /mentor/apply route must exist');
assert(appRoutesContent.includes('path="/mentor/projects"'), 'Canonical /mentor/projects route must exist');
assert(appRoutesContent.includes('path="/mentor/requests"'), 'Canonical /mentor/requests route must exist');
assert(appRoutesContent.includes('path="/mentor/earnings"'), 'Canonical /mentor/earnings route must exist');
assert(appRoutesContent.includes('path="/mentor/profile"'), 'Canonical /mentor/profile route must exist');

// 2. Check removed legacy duplicate routes
assert(!appRoutesContent.includes('path="/mentors"'), 'Legacy /mentors redirect route must be removed');
assert(!appRoutesContent.includes('path="/mentor-application"'), 'Legacy /mentor-application route must be removed');
assert(!appRoutesContent.includes('path="/mentored-projects"'), 'Legacy /mentored-projects route must be removed');
assert(!appRoutesContent.includes('path="/mentor-requests"'), 'Legacy /mentor-requests route must be removed');
assert(!appRoutesContent.includes('path="/mentor-earnings"'), 'Legacy /mentor-earnings route must be removed');
assert(!appRoutesContent.includes('path="/mentor-profile"'), 'Legacy /mentor-profile route must be removed');

// 3. Check NotFound catch-all route
assert(appRoutesContent.includes('<Route path="*" element={<NotFound />} />'), 'Catch-all NotFound route must exist');
assert(fs.existsSync('React-Implementation/React-Implementation/src/pages/NotFound.jsx'), 'NotFound.jsx component file must exist');

// 4. Check legacy state migration logic
assert(appRoutesContent.includes('LEGACY_PATH_MAP'), 'LEGACY_PATH_MAP must be defined');
assert(appRoutesContent.includes('teamforge.viewState'), 'sessionStorage teamforge.viewState migration must be present');

console.log('ALL PHASE 1 ROUTE CHECKS PASSED!');
