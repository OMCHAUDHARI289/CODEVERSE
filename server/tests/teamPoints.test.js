import test from 'node:test';
import assert from 'node:assert/strict';

import { distributeTeamPoints, getEqualMemberShare } from '../utils/teamPoints.js';

test('equal member share is computed from total team score', () => {
  assert.equal(getEqualMemberShare(300, 3), 100);
  assert.equal(getEqualMemberShare(100, 3), 33.33);
  assert.equal(getEqualMemberShare(0, 3), 0);
});

test('team points are evenly divided across members', () => {
  const result = distributeTeamPoints(300, [
    { name: 'A' },
    { name: 'B' },
    { name: 'C' }
  ]);

  assert.deepEqual(result, [
    { name: 'A', points: 100 },
    { name: 'B', points: 100 },
    { name: 'C', points: 100 }
  ]);
});
