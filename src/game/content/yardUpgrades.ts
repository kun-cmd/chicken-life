import type { Vec2 } from '../simulation/state';

export type YardUpgradeId =
  | 'shade-shelter'
  | 'low-perch'
  | 'water-basin'
  | 'premium-feed'
  | 'coop-roof'
  | 'coop-ramp'
  | 'yard-lamp'
  | 'door-latch';

export interface YardUpgradeDefinition {
  id: YardUpgradeId;
  name: string;
  cost: number;
  position: Vec2;
  effect: string;
}

export const YARD_LAMP_POSITION: Vec2 = { x: 930, y: 430 };
export const WATER_BASIN_POSITION: Vec2 = { x: 875, y: 520 };
export const PREMIUM_FEED_POSITION: Vec2 = { x: 620, y: 390 };
export const COOP_ROOF_POSITION: Vec2 = { x: 1128, y: 282 };

export const YARD_UPGRADES: YardUpgradeDefinition[] = [
  {
    id: 'yard-lamp',
    name: '门外灯泡',
    cost: 2,
    position: YARD_LAMP_POSITION,
    effect: '照见门外夜虫；每夜第一次靠近降低 5～6 点夜压',
  },
  {
    id: 'water-basin',
    name: '水盆',
    cost: 3,
    position: WATER_BASIN_POSITION,
    effect: '清晨装水，白天饮用后快速降温',
  },
  {
    id: 'premium-feed',
    name: '优质饲料桶',
    cost: 4,
    position: PREMIUM_FEED_POSITION,
    effect: '清晨舀一勺，让院子里多一份稳定谷物',
  },
  {
    id: 'shade-shelter',
    name: '遮阴布',
    cost: 4,
    position: { x: 930, y: 600 },
    effect: '形成稳定阴影，让鸡乘凉、打盹和梳理羽毛',
  },
  {
    id: 'coop-roof',
    name: '加固鸡窝',
    cost: 5,
    position: COOP_ROOF_POSITION,
    effect: '雨夜保持干燥，避免次日蛋品质因淋雨下降',
  },
  {
    id: 'low-perch',
    name: '木箱瞭望台',
    cost: 6,
    position: { x: 340, y: 690 },
    effect: '增加跳跃路线，让鸡从高处观察远方',
  },
];

export function isYardUpgradeId(value: unknown): value is YardUpgradeId {
  return YARD_UPGRADES.some((upgrade) => upgrade.id === value);
}
