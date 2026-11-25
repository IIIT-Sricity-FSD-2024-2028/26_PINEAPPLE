import { Injectable } from '@nestjs/common';
import { LedgerEntryDto } from './dto/ledger-entry.dto';
import { GamificationStatsDto } from './dto/gamification-stats.dto';

@Injectable()
export class GamificationRepository {
  private ledgers: LedgerEntryDto[] = [];

  constructor() {
    this.initSeeds();
  }

  private initSeeds(): void {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const d25 = new Date(now - 25 * dayMs).toISOString();
    const d22 = new Date(now - 22 * dayMs).toISOString();
    const d20 = new Date(now - 20 * dayMs).toISOString();
    const d14 = new Date(now - 14 * dayMs).toISOString();
    const d13 = new Date(now - 13 * dayMs).toISOString();
    const d12 = new Date(now - 12 * dayMs).toISOString();
    const d11 = new Date(now - 11 * dayMs).toISOString();
    const d10 = new Date(now - 10 * dayMs).toISOString();
    const d5 = new Date(now - 5 * dayMs).toISOString();
    const d4 = new Date(now - 4 * dayMs).toISOString();
    const d3 = new Date(now - 3 * dayMs).toISOString();
    const d2 = new Date(now - 2 * dayMs).toISOString();

    // 1. Priya Patel (id: '1') -> Total 3850 XP, 93 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-1-1',
        userId: '1',
        taskId: null,
        projectId: 'proj-1',
        xp: 3850,
        reason: 'Seed data: Architecture & Platform Setup',
        date: d20,
      },
    );

    // 2. Arjun Sharma (id: '2') -> Total 2450 XP, 87 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-2-1',
        userId: '2',
        taskId: null,
        projectId: 'proj-1',
        xp: 1250,
        reason: 'Seed data: Frontend Architecture & Components',
        date: d20,
      },
      {
        id: 'ledg-seed-2-2',
        userId: '2',
        taskId: null,
        projectId: 'proj-1',
        xp: 920,
        reason: 'Seed data: Auth Components & State',
        date: d12,
      },
      {
        id: 'ledg-seed-2-3',
        userId: '2',
        taskId: 'task-1',
        projectId: 'proj-1',
        xp: 280,
        reason: 'Task Approved: Design Database Schema',
        date: d4,
      },
    );

    // 3. Kiran Bose (id: '3') -> Total 950 XP, 71 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-3-1',
        userId: '3',
        taskId: null,
        projectId: null,
        xp: 950,
        reason: 'Seed data: Platform Contributions & Review',
        date: d25,
      },
    );

    // 4. Rohan Mehta (id: '4') -> Total 1850 XP, 89 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-4-1',
        userId: '4',
        taskId: null,
        projectId: 'proj-4',
        xp: 800,
        reason: 'Seed data: Design Systems',
        date: d20,
      },
      {
        id: 'ledg-seed-4-2',
        userId: '4',
        taskId: null,
        projectId: 'proj-4',
        xp: 630,
        reason: 'Seed data: UI Review',
        date: d10,
      },
      {
        id: 'ledg-seed-4-3',
        userId: '4',
        taskId: null,
        projectId: 'proj-4',
        xp: 420,
        reason: 'Seed data: Component Library',
        date: d2,
      },
    );

    // 5. Sneha Iyer (id: '5') -> Total 1480 XP, 82 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-5-1',
        userId: '5',
        taskId: null,
        projectId: 'proj-5',
        xp: 590,
        reason: 'Seed data: Infrastructure Setup',
        date: d20,
      },
      {
        id: 'ledg-seed-5-2',
        userId: '5',
        taskId: null,
        projectId: 'proj-5',
        xp: 510,
        reason: 'Seed data: Docker Orchestration',
        date: d11,
      },
      {
        id: 'ledg-seed-5-3',
        userId: '5',
        taskId: null,
        projectId: 'proj-5',
        xp: 380,
        reason: 'Seed data: CI/CD Pipeline',
        date: d2,
      },
    );

    // 6. Aditya Sai (id: '6') -> Total 850 XP, 40 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-6-1',
        userId: '6',
        taskId: null,
        projectId: 'proj-6',
        xp: 510,
        reason: 'Seed data: API Integration',
        date: d22,
      },
      {
        id: 'ledg-seed-6-2',
        userId: '6',
        taskId: null,
        projectId: 'proj-6',
        xp: 200,
        reason: 'Seed data: State Management',
        date: d13,
      },
      {
        id: 'ledg-seed-6-3',
        userId: '6',
        taskId: 'task-6',
        projectId: 'proj-7',
        xp: 140,
        reason: 'Task Approved: Data Collection & Cleaning',
        date: d4,
      },
    );

    // 7. Neha Gupta (id: '7') -> Total 1600 XP, 85 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-7-1',
        userId: '7',
        taskId: null,
        projectId: 'proj-7',
        xp: 920,
        reason: 'Seed data: Data Pipeline',
        date: d20,
      },
      {
        id: 'ledg-seed-7-2',
        userId: '7',
        taskId: null,
        projectId: 'proj-7',
        xp: 430,
        reason: 'Seed data: Model Evaluation',
        date: d12,
      },
      {
        id: 'ledg-seed-7-3',
        userId: '7',
        taskId: null,
        projectId: 'proj-7',
        xp: 250,
        reason: 'Seed data: Feature Engineering',
        date: d3,
      },
    );

    // 8. Vikram Nair (id: '8') -> Total 760 XP, 78 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-8-1',
        userId: '8',
        taskId: null,
        projectId: null,
        xp: 760,
        reason: 'Seed data: Backend Services & API Security',
        date: d22,
      },
    );

    // 9. Aditya (id: 'u-collab') -> Total 450 XP, 40 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-uc-1',
        userId: 'u-collab',
        taskId: null,
        projectId: 'proj-1',
        xp: 200,
        reason: 'Seed data: UI Components',
        date: d20,
      },
      {
        id: 'ledg-seed-uc-2',
        userId: 'u-collab',
        taskId: null,
        projectId: 'proj-1',
        xp: 150,
        reason: 'Seed data: Responsive Layouts',
        date: d10,
      },
      {
        id: 'ledg-seed-uc-3',
        userId: 'u-collab',
        taskId: null,
        projectId: 'proj-1',
        xp: 100,
        reason: 'Seed data: Unit Testing',
        date: d3,
      },
    );

    // 10. Jathin (id: 'u-owner') -> Total 1500 XP, 80 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-uo-1',
        userId: 'u-owner',
        taskId: null,
        projectId: 'proj-1',
        xp: 800,
        reason: 'Seed data: Product Strategy',
        date: d20,
      },
      {
        id: 'ledg-seed-uo-2',
        userId: 'u-owner',
        taskId: null,
        projectId: 'proj-1',
        xp: 500,
        reason: 'Seed data: Milestone Planning',
        date: d10,
      },
      {
        id: 'ledg-seed-uo-3',
        userId: 'u-owner',
        taskId: null,
        projectId: 'proj-1',
        xp: 200,
        reason: 'Seed data: Sprint Grooming',
        date: d3,
      },
    );

    // 11. Rohan Mehta (Mentor) (id: 'u-mentor') -> Total 2200 XP, 95 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-um-1',
        userId: 'u-mentor',
        taskId: null,
        projectId: 'proj-2',
        xp: 1200,
        reason: 'Seed data: Architecture Guidance',
        date: d20,
      },
      {
        id: 'ledg-seed-um-2',
        userId: 'u-mentor',
        taskId: null,
        projectId: 'proj-2',
        xp: 700,
        reason: 'Seed data: Security Advisory',
        date: d10,
      },
      {
        id: 'ledg-seed-um-3',
        userId: 'u-mentor',
        taskId: null,
        projectId: 'proj-2',
        xp: 300,
        reason: 'Seed data: Code Reviews',
        date: d3,
      },
    );

    // 12. Default Admin (id: 'u-admin') -> Total 3000 XP, 99 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-ua-1',
        userId: 'u-admin',
        taskId: null,
        projectId: null,
        xp: 2000,
        reason: 'Seed data: Platform Setup',
        date: d20,
      },
      {
        id: 'ledg-seed-ua-2',
        userId: 'u-admin',
        taskId: null,
        projectId: null,
        xp: 700,
        reason: 'Seed data: Compliance Audit',
        date: d10,
      },
      {
        id: 'ledg-seed-ua-3',
        userId: 'u-admin',
        taskId: null,
        projectId: null,
        xp: 300,
        reason: 'Seed data: Policy Enforcement',
        date: d3,
      },
    );

    // 13. Super User (id: 'u-superuser') -> Total 9999 XP, 100 Rep
    this.ledgers.push(
      {
        id: 'ledg-seed-us-1',
        userId: 'u-superuser',
        taskId: null,
        projectId: null,
        xp: 7999,
        reason: 'Seed data: Root Initialization',
        date: d20,
      },
      {
        id: 'ledg-seed-us-2',
        userId: 'u-superuser',
        taskId: null,
        projectId: null,
        xp: 1500,
        reason: 'Seed data: Global Infrastructure',
        date: d10,
      },
      {
        id: 'ledg-seed-us-3',
        userId: 'u-superuser',
        taskId: null,
        projectId: null,
        xp: 500,
        reason: 'Seed data: System Governance',
        date: d3,
      },
    );
  }

  addLedgerEntry(entry: LedgerEntryDto): void {
    this.ledgers.push(entry);
  }

  findByTaskId(taskId: string): LedgerEntryDto | undefined {
    if (!taskId) return undefined;
    return this.ledgers.find((l) => l.taskId && String(l.taskId) === String(taskId));
  }

  findByUserId(userId: string): LedgerEntryDto[] {
    const uid = String(userId);
    return this.ledgers
      .filter((l) => String(l.userId) === uid)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  findAll(): LedgerEntryDto[] {
    return this.ledgers;
  }

  // Compatibility helpers computed strictly from XP ledger (reputation lives only in ReputationService)
  getStatsByUserId(userId: string): GamificationStatsDto | undefined {
    const entries = this.findByUserId(userId);
    if (!entries.length) return undefined;
    const totalXp = entries.reduce((sum, e) => sum + (e.xp || 0), 0);
    const newestDate = entries[0]?.date ? new Date(entries[0].date) : new Date();
    return {
      userId,
      totalXp,
      repScore: 0,
      lastActive: newestDate,
    };
  }

  getAllStats(): GamificationStatsDto[] {
    const userIds = Array.from(new Set(this.ledgers.map((l) => String(l.userId))));
    return userIds
      .map((uid) => this.getStatsByUserId(uid))
      .filter(Boolean) as GamificationStatsDto[];
  }

  upsertStats(_statsData: GamificationStatsDto): void {
    // Stats are computed from ledger; no-op for backward compatibility
  }

  resetToSeed(): void {
    this.ledgers = [];
    this.initSeeds();
  }

  reset(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_STORE_RESET) return;
    this.resetToSeed();
  }
}
