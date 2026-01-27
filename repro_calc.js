// Logic copied from RefundCalculator.tsx
function calculateFoodExpense(um, meal) {
    const 朝食回数 = meal?.朝食 || 0;
    const 昼食回数 = meal?.昼食 || 0;
    const 夕食回数 = meal?.夕食 || 0;
    const 行事食回数 = meal?.行事食 || 0;

    const 朝食単価 = um.朝食費 || 0;
    const 昼食単価 = um.昼食費 || 0;
    const 夕食単価 = um.夕食費 || 0;
    const 行事食単価 = um.行事食 || 0;

    const 朝食費 = 朝食回数 * 朝食単価;
    const 昼食費 = 昼食回数 * 昼食単価;
    const 夕食費 = 夕食回数 * 夕食単価;
    const 行事食費 = 行事食回数 * 行事食単価;

    const 食費合計 = 朝食費 + 昼食費 + 夕食費 + 行事食費;

    return {
        朝食費,
        昼食費,
        夕食費,
        行事食費,
        食費合計
    };
}

// Test Case
const testUM = {
    年月: '2024-04',
    利用者ID: 'USER01',
    氏名: 'Test User',
    所属ユニット: 'Unit A',
    月額預り金: 100000,
    家賃補助: 0,
    日用品費: 0,
    修繕積立金: 0,
    朝食費: 300, // Unit Price
    昼食費: 500, // Unit Price
    夕食費: 600, // Unit Price
    行事食: 1000, // Unit Price
    金銭管理費: 0,
    火災保険: 0,
    備考: ''
};

const testMeal = {
    月: '2024-04',
    利用者ID: 'USER01',
    氏名: 'Test User',
    ユニット名: 'Unit A',
    朝食: 10,
    昼食: 20,
    夕食: 30,
    行事食: 1,
    備考: ''
};

console.log('--- Test Calculation ---');
console.log('Unit Prices:', {
    朝食: testUM.朝食費,
    昼食: testUM.昼食費,
    夕食: testUM.夕食費,
    行事食: testUM.行事食
});
console.log('Meal Counts:', {
    朝食: testMeal.朝食,
    昼食: testMeal.昼食,
    夕食: testMeal.夕食,
    行事食: testMeal.行事食
});

const result = calculateFoodExpense(testUM, testMeal);
console.log('Result:', result);

const expectedTotal = (300 * 10) + (500 * 20) + (600 * 30) + (1000 * 1);
console.log('Expected Total:', expectedTotal);

if (result.食費合計 === expectedTotal) {
    console.log('✅ Calculation is CORRECT based on (Unit Price * Count)');
} else {
    console.error('❌ Calculation is INCORRECT based on (Unit Price * Count)');
}
