/**
 * Standalone test script for Al-Zahraa integration.
 * Run locally via:
 * npx tsx scripts/test-zahraa.ts
 *
 * Requirements:
 * Provide TEST_ZAHRAA_NATIONAL_ID and TEST_ZAHRAA_PASSWORD in your environment or .env.local
 */

import { loginToZahraa, fetchMeals, bookMealsSafely, categorizeMeal } from "../lib/zahraa";
import { getCairoNow, getTomorrowCairoDate, formatArabicDate } from "../lib/time";

async function runTest() {
  console.log("=================================================");
  console.log("🍴 Al-Zahraa Integration Standalone Diagnostic");
  console.log("=================================================");

  const nationalId = process.env.TEST_ZAHRAA_NATIONAL_ID || process.argv[2];
  const password = process.env.TEST_ZAHRAA_PASSWORD || process.argv[3];

  if (!nationalId || !password) {
    console.error("❌ Error: Missing credentials!");
    console.log("Usage:");
    console.log("  npx tsx scripts/test-zahraa.ts <NATIONAL_ID> <PASSWORD>");
    console.log("or set TEST_ZAHRAA_NATIONAL_ID and TEST_ZAHRAA_PASSWORD in your environment.");
    process.exit(1);
  }

  const cairo = getCairoNow();
  console.log(`📍 Current Cairo Time: ${cairo.dateStr} ${cairo.timeStr}`);
  const tomorrow = getTomorrowCairoDate();
  console.log(`📅 Target Tomorrow: ${tomorrow} (${formatArabicDate(tomorrow)})`);

  // Force DRY_RUN for testing safety
  process.env.DRY_RUN = "true";

  // 1. Test Login
  console.log("\n[1/4] Attempting login to https://hostel.cu.edu.eg/studentHome...");
  const startTime = Date.now();
  let jar;
  try {
    jar = await loginToZahraa(nationalId, password);
    const duration = Date.now() - startTime;
    console.log(`✅ Login successful in ${duration}ms! Session cookies acquired.`);
  } catch (err: unknown) {
    console.error(`❌ Login failed: ${(err as Error).message}`);
    process.exit(1);
  }

  // 2. Test Fetch Meals
  console.log("\n[2/4] Fetching meals schedule (fnName=getMeals)...");
  let mealsData;
  try {
    mealsData = await fetchMeals(jar);
    console.log(`✅ Meals retrieved! Range: ${mealsData.minDate} -> ${mealsData.maxDate}`);
  } catch (err: unknown) {
    console.error(`❌ Failed to fetch meals: ${(err as Error).message}`);
    process.exit(1);
  }

  // 3. Inspect Tomorrow's Meals
  console.log(`\n[3/4] Inspecting meals for tomorrow (${tomorrow})...`);
  const tomorrowSchedule = mealsData.daysDict?.[tomorrow];
  if (!tomorrowSchedule) {
    console.log(`⚠️ Note: Target date ${tomorrow} not present in daysDict.`);
    console.log("Available dates in schedule:", Object.keys(mealsData.daysDict || {}));
  } else {
    console.log(`Found ${tomorrowSchedule.meals?.length || 0} meals listed for ${tomorrow}:`);
    for (const m of tomorrowSchedule.meals || []) {
      const type = categorizeMeal(m.mealName);
      console.log(
        `  - [ID: ${m.mealID}] ${m.mealName} (Type: ${type}) | Booked: ${Boolean(m.booked)} | Disabled: ${Boolean(m.disabled)}`
      );
    }
  }

  // 4. Test Dry-Run Booking
  console.log("\n[4/4] Testing bookMealsSafely in DRY_RUN mode (no booking will be finalized)...");
  try {
    const bookingResult = await bookMealsSafely({
      nationalId,
      password,
      targetDate: tomorrow,
      choice: { lunch: true, dinner: true },
    });
    console.log(`✅ Dry-Run booking succeeded!`);
    console.log(`   Message: ${bookingResult.message}`);
    console.log(`   Booked Meals: ${bookingResult.bookedMeals.join(" + ")}`);
  } catch (err: unknown) {
    console.log(`⚠️ Dry-Run execution note: ${(err as Error).message}`);
  }

  console.log("\n=================================================");
  console.log("🎉 Al-Zahraa diagnostic completed successfully!");
  console.log("=================================================");
}

runTest().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
