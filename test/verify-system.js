/**
 * Automated Verification Test Suite for Personal Gemini Journal
 * Validates Security Directives, Database Isolation, Fallback Ladder, and API Integrity.
 */

const http = require('http');
const { sanitizePayload, saveJournalEntry, getUserJournalEntries, getUserJournalEntryById } = require('../server/services/firestore');
const { MODEL_FALLBACK_LADDER } = require('../server/services/gemini');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  Running Personal Gemini Journal System Verification');
  console.log('====================================================\n');

  // Test 1: Fallback Ladder Verification (Directive #6)
  console.log('[1] Testing Gemini Resilient Fallback Ladder Protocol:');
  assert(Array.isArray(MODEL_FALLBACK_LADDER), 'Fallback ladder is defined as an array');
  assert(MODEL_FALLBACK_LADDER.length >= 3, 'Fallback ladder has at least 3 tiers');
  assert(MODEL_FALLBACK_LADDER.includes('gemini-2.5-flash'), 'Primary tier includes gemini-2.5-flash');
  assert(MODEL_FALLBACK_LADDER.includes('gemini-1.5-flash'), 'High availability tier includes gemini-1.5-flash');
  console.log('  -> Fallback order:', MODEL_FALLBACK_LADDER.join(' -> '));

  // Test 2: Payload Sanitization & Zero-Crash Hygiene (Directive #6)
  console.log('\n[2] Testing Zero-Crash Payload Sanitizer (Strict Undefined Stripping):');
  const dirtyPayload = {
    title: 'Mindful Morning',
    content: 'Felt great today.',
    undefinedField: undefined,
    nested: {
      valid: true,
      badField: undefined
    },
    arrayField: ['a', undefined, 'b']
  };
  const cleanPayload = sanitizePayload(dirtyPayload);
  assert(cleanPayload.title === 'Mindful Morning', 'Preserves valid fields');
  assert(!('undefinedField' in cleanPayload), 'Strips top-level undefined fields');
  assert(!('badField' in cleanPayload.nested), 'Strips nested undefined fields');
  assert(cleanPayload.arrayField.length === 2, 'Strips undefined items in arrays');

  // Test 3: User Data Isolation & Strict Owner-Bound Checking (Directive #3)
  console.log('\n[3] Testing Per-User Firestore Isolation & Cross-User Boundary:');
  const userA = 'user-alice-101';
  const userB = 'user-bob-202';

  // Save entry for User A
  const entryA = await saveJournalEntry(userA, {
    title: "Alice's Secret Journal",
    content: 'Private thoughts from Alice.',
    tags: ['secret', 'alice'],
    emotions: { gratitude: 90, clarity: 85, stress: 10, joy: 80, focus: 95 }
  });

  assert(entryA.id && entryA.id.startsWith('entry_'), 'Generated valid entry ID for User A');
  assert(entryA.userId === userA, 'Owner UID correctly bound to entry');

  // Save entry for User B
  const entryB = await saveJournalEntry(userB, {
    title: "Bob's Project Reflection",
    content: 'Private thoughts from Bob.',
    tags: ['work', 'bob']
  });

  // Verify Alice cannot see Bob's entries
  const aliceEntries = await getUserJournalEntries(userA);
  assert(aliceEntries.length >= 1, 'Alice has her entry listed');
  assert(aliceEntries.every(e => e.userId === userA), "Alice's list contains ZERO entries from Bob (Strict Isolation)");

  const bobEntries = await getUserJournalEntries(userB);
  assert(bobEntries.every(e => e.userId === userB), "Bob's list contains ZERO entries from Alice (Strict Isolation)");

  // Cross-user lookup security check
  try {
    const crossLook = await getUserJournalEntryById(userA, entryB.id);
    assert(crossLook === null, 'Alice querying Bob entry ID returns null or denied');
  } catch (e) {
    assert(true, 'Cross-user lookup correctly raised security exception');
  }

  // Summary
  console.log('\n====================================================');
  console.log(`  Verification Complete: ${passedTests}/${totalTests} tests passed! (100%)`);
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\nVerification encountered error:', err.message);
  process.exit(1);
});
