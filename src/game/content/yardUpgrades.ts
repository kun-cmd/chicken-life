import type { Vec2 } from '../simulation/state';

export type YardUpgradeId =
  | 'loose-soil'
  | 'shade-shelter'
  | 'low-perch'
  | 'coop-ramp'
  | 'yard-lamp'
  | 'door-latch';

export interface YardUpgradeDefinition {
  id: YardUpgradeId;
  name: string;
  cost: 1 | 2 | 3;
  position: Vec2;
  effect: string;
}

export const YARD_LAMP_POSITION: Vec2 = { x: 930, y: 430 };

export const YARD_UPGRADES: YardUpgradeDefinition[] = [
  {
    id: 'loose-soil',
    name: '松土区',
    cost: 1,
    position: { x: 610, y: 565 },
    effect: '稳定出现蚯蚓，也能让鸡沙浴',
  },
  {
    id: 'shade-shelter',
    name: '遮阴棚',
    cost: 1,
    position: { x: 930, y: 600 },
    effect: '让鸡乘凉、打盹和梳理羽毛',
  },
  {
    id: 'low-perch',
    name: '低栖木',
    cost: 2,
    position: { x: 340, y: 690 },
    effect: '增加跳跃路线和高处休息点',
  },
  {
    id: 'coop-ramp',
    name: '鸡窝坡道',
    cost: 2,
    position: { x: 1068, y: 410 },
    effect: '扩大黄昏进窝的有效门槛',
  },
  {
    id: 'yard-lamp',
    name: '院灯',
    cost: 3,
    position: YARD_LAMP_POSITION,
    effect: '黄昏后提供固定安全光区',
  },
  {
    id: 'door-latch',
    name: '可靠门闩',
    cost: 3,
    position: { x: 1092, y: 380 },
    effect: '缩短鸡进窝后的关门动作',
  },
];
