
function parseUnitManagement(rows) {
    if (!rows || rows.length < 2) return [];
    return rows.slice(1).map((r, index) => {
        const rawId = r[1] ? String(r[1]) : "";
        const rawName = r[2] ? String(r[2]) : "";

        // Validation warning for potential column swap
        if (index < 5 && rawId.length > rawName.length && !rawId.match(/^[A-Za-z0-9]+$/)) {
            console.warn(`⚠️ Potential Column Swap Detected in UnitManagement row ${index + 2}: ID="${rawId}", Name="${rawName}". ID usually is shorter and alphanumeric.`);
        }

        return {
            年月: r[0],
            利用者ID: rawId,
            氏名: rawName,
            所属ユニット: r[3],
            ステータス: r[4]
        };
    });
}

function parseMealCount(rows) {
    // Assuming columns: A:月, B:ID, C:Name, D:Unit, ...
    if (!rows || rows.length < 2) return [];
    return rows.slice(1).map((r, index) => {
        const rawId = r[1] ? String(r[1]) : "";
        const rawName = r[2] ? String(r[2]) : "";

        // Validation warning for potential column swap
        if (index < 5 && rawId.length > rawName.length && !rawId.match(/^[A-Za-z0-9]+$/)) {
            console.warn(`⚠️ Potential Column Swap Detected in MealCount row ${index + 2}: ID="${rawId}", Name="${rawName}". ID usually is shorter and alphanumeric.`);
        }

        return {
            月: r[0],
            利用者ID: rawId,
            氏名: rawName,
            ユニット名: r[3]
        };
    });
}
