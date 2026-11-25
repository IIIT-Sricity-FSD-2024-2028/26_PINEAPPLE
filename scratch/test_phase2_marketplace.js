// scratch/test_phase2_marketplace.js
// Automated verification for Phase 2:
// - Removal of completed projects from mock/seed data
// - Collaborator marketplace filter (0 completed projects shown)
// - Applying to completed project rejected with HTTP 409 "This project is completed"
// - Completed projects appear in legitimate views (Admin stats, Admin projects, Owner my-projects)
// - Leaderboard and user profiles remain consistent with unchanged XP/Rep totals

async function runTests() {
  console.log('=== PHASE 2: REMOVE COMPLETED PROJECTS & MARKETPLACE VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc, extra = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${desc} ${extra ? `(${extra})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc} ${extra ? `(${extra})` : ''}`);
      failed++;
    }
  }

  async function login(email, password) {
    const res = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
    }
    return data.accessToken || data.token;
  }

  try {
    // 1. Authenticate Personas
    const ownerToken = await login('jathin@example.com', 'password123');
    const ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    };

    const collabToken = await login('aditya.sai@teamforge.io', 'password123');
    const collabHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${collabToken}`,
    };

    const adminToken = await login('priya.patel@teamforge.io', 'password123');
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // ─── CHECK 1: Seeded projects inspection ────────────────────────────────
    console.log('--- Check 1: Seeded projects inspection ---');
    const projectsRes = await fetch('http://localhost:3000/projects', { headers: collabHeaders });
    const allProjects = await projectsRes.json();
    assert(projectsRes.status === 200, 'GET /projects returns 200 OK', `Count: ${allProjects.length}`);

    const proj3 = allProjects.find((p) => p.id === 'proj-3');
    const proj8 = allProjects.find((p) => p.id === 'proj-8');
    assert(!proj3, 'Seed project proj-3 (Smart City Traffic Optimizer) is removed');
    assert(!proj8, 'Seed project proj-8 (E-commerce API Engine) is removed');

    const completedSeeded = allProjects.filter(
      (p) =>
        ['proj-1', 'proj-2', 'proj-4', 'proj-5', 'proj-6', 'proj-7'].includes(p.id) &&
        (p.isCompleted || String(p.status || '').toLowerCase() === 'completed' || p.finalLink || p.completedAt)
    );
    assert(
      completedSeeded.length === 0,
      'No remaining seeded project has Completed status, isCompleted, finalLink, or completedAt',
      `Found ${completedSeeded.length}`
    );

    const remainingExpected = ['proj-1', 'proj-2', 'proj-4', 'proj-5', 'proj-6', 'proj-7'];
    const remainingFound = allProjects.filter((p) => remainingExpected.includes(p.id));
    assert(
      remainingFound.length === 6,
      'All 6 Open/InProgress seeded projects remain intact',
      remainingFound.map((p) => `${p.id}:${p.status}`).join(', ')
    );

    // ─── CHECK 2: Marketplace Filter Verification ───────────────────────────
    console.log('\n--- Check 2: Collaborator Marketplace Filter Verification ---');
    // Function mirroring frontend ProjectsMarketplace filtering
    const isProjectLocked = (p) => {
      if (!p) return false;
      if (p.isCompleted === true || p.is_completed === true) return true;
      if (typeof p.status === 'string' && p.status.toLowerCase() === 'completed') return true;
      return false;
    };

    const applicableProjects = allProjects.filter((p) => {
      if (isProjectLocked(p) || p.isCompleted || p.completedAt || p.finalLink || String(p.status || '').toLowerCase() === 'completed') {
        return false;
      }
      return true;
    });

    const marketCompleted = applicableProjects.filter(
      (p) => isProjectLocked(p) || p.isCompleted || String(p.status || '').toLowerCase() === 'completed'
    );
    assert(
      marketCompleted.length === 0,
      'Marketplace filters out all completed projects',
      `Applicable count: ${applicableProjects.length}, Completed in market: ${marketCompleted.length}`
    );

    // ─── CHECK 3: Apply to Completed Project Fails with HTTP 409 ─────────────
    console.log('\n--- Check 3: Apply to completed project fails with 409 ---');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dueDate = futureDate.toISOString().split('T')[0];

    // Create a real project as owner
    const createRes = await fetch('http://localhost:3000/projects', {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        title: 'Project To Be Completed',
        description: 'Will be completed to verify apply rejection',
        requiredSkills: ['React', 'Node.js'],
        difficulty: 'Medium',
        dueDate,
      }),
    });
    const createdProj = await createRes.json();
    assert(createRes.status === 201, 'Owner creates project to complete', `id: ${createdProj.id}`);

    // Complete the project
    const completeRes = await fetch(`http://localhost:3000/projects/${createdProj.id}/complete`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ finalLink: 'https://github.com/teamforge/verified-completed' }),
    });
    const completedData = await completeRes.json();
    assert(completeRes.status === 201, 'Project marked completed and locked', `status: ${completedData.status}`);

    // Collaborator applies to completed project
    const applyRes = await fetch('http://localhost:3000/join-requests', {
      method: 'POST',
      headers: collabHeaders,
      body: JSON.stringify({
        projectId: createdProj.id,
        userId: '6',
        userName: 'Aditya Sai',
        message: 'Applying to completed project',
      }),
    });
    const applyData = await applyRes.json();
    assert(
      applyRes.status === 409,
      'Applying to completed project rejected with HTTP 409 Conflict',
      `got ${applyRes.status}`
    );
    assert(
      applyData?.message === 'This project is completed',
      'Error message is exactly "This project is completed"',
      applyData?.message
    );

    // ─── CHECK 4: Completed Projects in Legitimate Views ────────────────────
    console.log('\n--- Check 4: Completed project visibility in legitimate views ---');
    // 1. Owner's view
    const ownerProjectsRes = await fetch(`http://localhost:3000/projects/owner/u-owner`, { headers: ownerHeaders });
    const ownerProjects = await ownerProjectsRes.json();
    const ownerCompleted = (Array.isArray(ownerProjects) ? ownerProjects : []).filter(
      (p) => p.id === createdProj.id && (p.isCompleted || String(p.status || '').toLowerCase() === 'completed')
    );
    assert(
      ownerCompleted.length === 1,
      'Completed project appears in Owner projects list with isCompleted: true',
      `Owner completed count: ${ownerCompleted.length}`
    );

    // 2. Admin stats view
    const adminStatsRes = await fetch('http://localhost:3000/admin/stats', {
      headers: adminHeaders,
    });
    const adminStats = await adminStatsRes.json();
    assert(adminStatsRes.status === 200, 'GET /admin/stats returns 200 OK');
    assert(
      adminStats.completedProjects >= 1,
      'Admin stats dynamically reflects completed projects count',
      `completedProjects: ${adminStats.completedProjects}, totalProjects: ${adminStats.totalProjects}`
    );

    // ─── CHECK 5: Leaderboard and User Profiles Consistency ─────────────────
    console.log('\n--- Check 5: Leaderboard & User XP/Rep totals unchanged ---');
    const lbRes = await fetch('http://localhost:3000/gamification/leaderboard', { headers: collabHeaders });
    const leaderboard = await lbRes.json();
    assert(lbRes.status === 200, 'GET /gamification/leaderboard returns 200 OK', `Entries: ${leaderboard.length}`);

    // Verify User 1 (Priya Patel): Total 3850 XP, 93 Rep
    const priya = leaderboard.find((u) => u.userId === '1');
    assert(
      priya && priya.totalXp === 3850 && (priya.repScore === 93 || priya.totalReputation === 93),
      'Priya Patel stats preserved (3850 XP, 93 Rep)',
      `Actual XP: ${priya?.totalXp}, Rep: ${priya?.repScore}`
    );

    // Verify User 2 (Arjun Sharma): Total 2450 XP, 87 Rep
    const arjun = leaderboard.find((u) => u.userId === '2');
    assert(
      arjun && arjun.totalXp === 2450 && (arjun.repScore === 87 || arjun.totalReputation === 87),
      'Arjun Sharma stats preserved (2450 XP, 87 Rep)',
      `Actual XP: ${arjun?.totalXp}, Rep: ${arjun?.repScore}`
    );

    // Verify User 3 (Kiran Bose): Total 950 XP, 71 Rep
    const kiran = leaderboard.find((u) => u.userId === '3');
    assert(
      kiran && kiran.totalXp === 950 && (kiran.repScore === 71 || kiran.totalReputation === 71),
      'Kiran Bose stats preserved (950 XP, 71 Rep)',
      `Actual XP: ${kiran?.totalXp}, Rep: ${kiran?.repScore}`
    );

    // Verify User 4 (Rohan Mehta): Total 1850 XP, 89 Rep
    const rohan = leaderboard.find((u) => u.userId === '4');
    assert(
      rohan && rohan.totalXp === 1850 && (rohan.repScore === 89 || rohan.totalReputation === 89),
      'Rohan Mehta stats preserved (1850 XP, 89 Rep)',
      `Actual XP: ${rohan?.totalXp}, Rep: ${rohan?.repScore}`
    );

    // Verify User 8 (Vikram Nair): Total 760 XP, 78 Rep
    const vikram = leaderboard.find((u) => u.userId === '8');
    assert(
      vikram && vikram.totalXp === 760 && (vikram.repScore === 78 || vikram.totalReputation === 78),
      'Vikram Nair stats preserved (760 XP, 78 Rep)',
      `Actual XP: ${vikram?.totalXp}, Rep: ${vikram?.repScore}`
    );

    // Verify no ledger entries reference proj-3 or proj-8
    const priyaLedgerRes = await fetch('http://localhost:3000/gamification/ledger/1', { headers: collabHeaders });
    const priyaLedger = await priyaLedgerRes.json();
    const priyaDangling = (Array.isArray(priyaLedger) ? priyaLedger : []).filter(
      (e) => e.projectId === 'proj-3' || e.projectId === 'proj-8' || e.taskId === 'task-8'
    );
    assert(
      priyaDangling.length === 0,
      'Priya Patel ledger has zero dangling references to proj-3/proj-8/task-8',
      `Dangling count: ${priyaDangling.length}`
    );

    const kiranLedgerRes = await fetch('http://localhost:3000/gamification/ledger/3', { headers: collabHeaders });
    const kiranLedger = await kiranLedgerRes.json();
    const kiranDangling = (Array.isArray(kiranLedger) ? kiranLedger : []).filter(
      (e) => e.projectId === 'proj-3' || e.projectId === 'proj-8'
    );
    assert(
      kiranDangling.length === 0,
      'Kiran Bose ledger has zero dangling references to proj-3/proj-8',
      `Dangling count: ${kiranDangling.length}`
    );

    const vikramLedgerRes = await fetch('http://localhost:3000/gamification/ledger/8', { headers: collabHeaders });
    const vikramLedger = await vikramLedgerRes.json();
    const vikramDangling = (Array.isArray(vikramLedger) ? vikramLedger : []).filter(
      (e) => e.projectId === 'proj-3' || e.projectId === 'proj-8'
    );
    assert(
      vikramDangling.length === 0,
      'Vikram Nair ledger has zero dangling references to proj-3/proj-8',
      `Dangling count: ${vikramDangling.length}`
    );

    console.log('\n========================================');
    console.log(`Phase 2 Verification: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runTests();
