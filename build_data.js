// 役所マップのdata.jsonと待機児童データをマージして kosodate_data.json を生成
const fs = require('fs');

// 1. 役所マップの全データ読み込み
const officeData = JSON.parse(fs.readFileSync('../01_yakusho_map/data.json', 'utf-8'));

// 2. 令和6年 待機児童データ
const waitingRaw = JSON.parse(fs.readFileSync('./waiting_r6.json', 'utf-8'));
// {pref, name, waitingChildren} → キー: "都道府県_市区町村名"
const waitingMap = {};
for (const w of waitingRaw) {
  waitingMap[`${w.pref}_${w.name}`] = w.waitingChildren;
}

// 3. 役所データから市区町村を正規化（重複除去）
// 役所名から市区町村名を抽出
// 戻り値: { muniName: string }
function getMuniName(officeName) {
  // 政令市支所: "XX市YY区役所" → "XX市"
  const cityBranch = officeName.match(/^(.+市).+区役所$/);
  if (cityBranch) return cityBranch[1];
  // 通常パターン
  let name = officeName
    .replace(/市役所$/, '市')
    .replace(/区役所$/, '区')
    .replace(/町役場$/, '町')
    .replace(/村役場$/, '村')
    .replace(/(役場|役所)$/, '');
  // 郡名プレフィックスを除去（町・村のみ。市は「大和郡山市」「小郡市」など郡が固有名の一部のため除外）
  if (name.endsWith('町') || name.endsWith('村')) {
    name = name.replace(/^.+郡/, '');
  }
  return name;
}

const muniMap = {}; // key: "pref_muniName" → {name, pref, lat, lng}

for (const office of officeData) {
  const muniName = getMuniName(office.name);
  if (!muniName) continue;
  const key = `${office.pref}_${muniName}`;
  if (!muniMap[key]) {
    muniMap[key] = { name: muniName, pref: office.pref, lat: office.lat, lng: office.lng };
  }
}

// 3b. data.jsonに未収録の小規模町村の座標補完テーブル
const FALLBACK_COORDS = {
  "北海道_猿払村":    [45.1939, 142.2037], "北海道_新十津川町": [43.5538, 141.9047],
  "北海道_赤井川村":  [43.0789, 140.9058], "北海道_中札内村":   [42.7044, 143.1036],
  "北海道_弟子屈町":  [43.5419, 144.4575], "北海道_標茶町":     [43.3081, 144.6047],
  "北海道_余市町":    [43.1824, 140.7836], "北海道_利尻町":     [45.1833, 141.2500],
  "岩手県_紫波町":    [39.5508, 141.1447],
  "宮城県_柴田町":    [38.0486, 140.7658],
  "群馬県_玉村町":    [36.3044, 139.0997], "群馬県_嬬恋村":     [36.5237, 138.5292],
  "埼玉県_毛呂山町":  [35.9305, 139.3109],
  "三重県_東員町":    [35.0622, 136.6439],
  "神奈川県_寒川町":  [35.3799, 139.3855], "神奈川県_松田町":   [35.3510, 139.1367],
  "神奈川県_大井町":  [35.3380, 139.1565], "神奈川県_大磯町":   [35.3086, 139.3212],
  "神奈川県_葉山町":  [35.2722, 139.5786],
  "長野県_下諏訪町":  [36.0759, 138.0817], "長野県_信濃町":     [36.8120, 138.2063],
  "滋賀県_愛荘町":    [35.1834, 136.2325], "滋賀県_日野町":     [35.0079, 136.2564],
  "滋賀県_豊郷町":    [35.1792, 136.1993],
  "岡山県_鏡野町":    [35.0783, 133.9317],
  "奈良県_王寺町":    [34.5975, 135.7043], "奈良県_河合町":     [34.5944, 135.7205],
  "奈良県_広陵町":    [34.5475, 135.7547], "奈良県_三郷町":     [34.6167, 135.7386],
  "奈良県_上牧町":    [34.5867, 135.7178], "奈良県_田原本町":   [34.5351, 135.7848],
  "佐賀県_吉野ヶ里町":[33.3414, 130.3978], "佐賀県_上峰町":     [33.2980, 130.3889],
  "福岡県_宇美町":    [33.5671, 130.5259], "福岡県_岡垣町":     [33.8486, 130.6046],
  "福岡県_篠栗町":    [33.5948, 130.5413],
  "福島県_西郷村":    [37.1024, 140.2067], "福島県_棚倉町":     [37.0228, 140.3776],
  "福島県_矢吹町":    [37.1990, 140.3432],
  "兵庫県_稲美町":    [34.6993, 134.9150], "兵庫県_播磨町":     [34.7226, 134.8787],
  "熊本県_菊陽町":    [32.8806, 130.8628],
  "沖縄県_読谷村":    [26.3993, 127.7449], "沖縄県_北谷町":     [26.3151, 127.7599],
  "沖縄県_恩納村":    [26.5066, 127.8647], "沖縄県_久米島町":   [26.3404, 126.7950],
  "沖縄県_座間味村":  [26.2289, 127.3046], "沖縄県_西原町":     [26.2395, 127.7698],
  "沖縄県_大宜味村":  [26.7133, 128.1453], "沖縄県_中城村":     [26.2784, 127.7993],
  "沖縄県_八重瀬町":  [26.1493, 127.7454], "沖縄県_北大東村":   [25.9453, 131.3048],
  "沖縄県_北中城村":  [26.3069, 127.7906], "沖縄県_与那原町":   [26.2012, 127.7549],
  "沖縄県_与那国町":  [24.4668, 122.9990],
};

// 3c. 給食費無償化の確認済み自治体セット
const lunchFreeRaw = JSON.parse(fs.readFileSync('./lunch_free_known.json', 'utf-8'));
const lunchFreeSet = new Set(lunchFreeRaw.map(r => `${r.pref}_${r.name}`));

// 3d. 医療費助成 都道府県別基準値（こども家庭庁 令和6年4月1日時点）
const medicalAidPref = JSON.parse(fs.readFileSync('./medical_aid_pref.json', 'utf-8'));

// 3e. 医療費助成 手動確認済みデータ（medical_aid_sources.csv）
// フォーマット: jiscode,pref,name,medicalAidAge,sourceUrl,confirmedDate,notes
const sourcesRaw = fs.readFileSync('./medical_aid_sources.csv', 'utf-8');
const sourcesMap = {}; // "pref_name" → { age, url }
for (const line of sourcesRaw.split('\n').slice(1)) { // ヘッダー行スキップ
  const cols = line.split(',');
  if (cols.length < 4) continue;
  const [jiscode, pref, name, ageStr] = cols;
  const age = parseInt(ageStr);
  const url = cols[4] || '';
  if (!pref || !name || isNaN(age)) continue; // 未確認行はスキップ
  sourcesMap[`${pref}_${name}`] = { age, url };
}
console.log(`medical_aid_sources.csv: ${Object.keys(sourcesMap).length}件読み込み`);

// 3f. 医療費助成 こども家庭庁 別紙3（令和6年4月1日時点・全市区町村）
const betusi3Raw = JSON.parse(fs.readFileSync('./betusi3_r6.json', 'utf-8'));
const betusi3Map = {};
for (const r of betusi3Raw) {
  betusi3Map[`${r.pref}_${r.name}`] = r.age;
}
console.log(`betusi3_r6.json: ${Object.keys(betusi3Map).length}件読み込み`);

// 3g. 医療費助成 市区別実データ（goo.ne.jp 住宅情報）
const medicalAidCityRaw = JSON.parse(fs.readFileSync('./medical_aid_city.json', 'utf-8'));
const medicalAidCityMap = {};
for (const r of medicalAidCityRaw) {
  medicalAidCityMap[`${r.pref}_${r.name}`] = r.age;
}
// 市区名のバリアント（ヶ/ケ・郡名除去）でマッチするヘルパー
// 優先順位: CSV手動確認 > こども家庭庁別紙3 > goo.ne.jp市区データ > 都道府県基準値
function getMedicalAidAge(pref, name) {
  const variants = new Set();
  for (const n of [name, name.replace(/^.+郡/, '')]) {
    variants.add(n);
    variants.add(n.replace(/ヶ/g, 'ケ'));
    variants.add(n.replace(/ケ/g, 'ヶ'));
  }
  // 1. CSV手動確認データ（最優先）
  for (const n of variants) {
    const v = sourcesMap[`${pref}_${n}`];
    if (v !== undefined) return v.age;
  }
  // 2. こども家庭庁 別紙3（令和6年4月・公式全市区町村）
  for (const n of variants) {
    const v = betusi3Map[`${pref}_${n}`];
    if (v !== undefined) return v;
  }
  // 3. goo.ne.jp 市区データ
  for (const n of variants) {
    const v = medicalAidCityMap[`${pref}_${n}`];
    if (v !== undefined) return v;
  }
  // 4. 都道府県基準値（フォールバック）
  return medicalAidPref[pref] ?? 18;
}
// 郡名除去 + ヶ/ケ正規化でマッチングするヘルパー
function lunchFreeKey(pref, name) {
  const variants = new Set();
  for (const n of [name, name.replace(/^.+郡/, '')]) {
    variants.add(n);
    variants.add(n.replace(/ヶ/g, 'ケ'));
    variants.add(n.replace(/ケ/g, 'ヶ'));
  }
  for (const n of variants) {
    if (lunchFreeSet.has(`${pref}_${n}`)) return true;
  }
  return false;
}

// 4. マージしてkosodate_data.jsonを構築
const kosodateData = [];
for (const [key, muni] of Object.entries(muniMap)) {
  const waitKey = `${muni.pref}_${muni.name}`;
  const waitingChildren = waitingMap[waitKey] || 0;
  const lunchFree = lunchFreeKey(muni.pref, muni.name);
  const medicalAidAge = getMedicalAidAge(muni.pref, muni.name);
  kosodateData.push({
    name: muni.name,
    pref: muni.pref,
    lat: muni.lat,
    lng: muni.lng,
    medicalAidAge,
    lunchFree,
    waitingChildren,
    waitingChildrenYear: 2024,
    migrationSupport: false,
    migrationAmount: 0,
  });
}

// 4b. data.jsonに未収録だがFALLBACK_COORDSに座標がある待機児童自治体を追加
for (const w of waitingRaw) {
  const key = `${w.pref}_${w.name}`;
  if (muniMap[key]) continue; // 既に追加済み
  const coords = FALLBACK_COORDS[key];
  if (!coords) continue; // 座標不明はスキップ
  const lunchFree = lunchFreeSet.has(key);
  const medicalAidAge = getMedicalAidAge(w.pref, w.name);
  kosodateData.push({
    name: w.name,
    pref: w.pref,
    lat: coords[0],
    lng: coords[1],
    medicalAidAge,
    lunchFree,
    waitingChildren: w.waitingChildren,
    waitingChildrenYear: 2024,
    migrationSupport: false,
    migrationAmount: 0,
  });
}

// normalizeMuniName は削除済み（getMuniName に統合）
// 都道府県・市区町村名でソート
kosodateData.sort((a, b) => {
  if (a.pref !== b.pref) return a.pref.localeCompare(b.pref, 'ja');
  return a.name.localeCompare(b.name, 'ja');
});

// 未マッチの待機児童データを確認
const matchedKeys = new Set(kosodateData.filter(d => d.waitingChildren > 0).map(d => `${d.pref}_${d.name}`));
const unmatched = waitingRaw.filter(w => w.waitingChildren > 0 && !matchedKeys.has(`${w.pref}_${w.name}`));
if (unmatched.length > 0) {
  console.log(`\n未マッチ (${unmatched.length}件):`);
  unmatched.forEach(u => console.log(`  "${u.pref}_${u.name}" (${u.waitingChildren}人)`));
}
console.log(`\n総市区町村数: ${kosodateData.length}`);
console.log(`待機児童あり: ${kosodateData.filter(d => d.waitingChildren > 0).length}`);
console.log(`上位10件:`, kosodateData.filter(d=>d.waitingChildren>0).sort((a,b)=>b.waitingChildren-a.waitingChildren).slice(0,10).map(d=>`${d.name}(${d.waitingChildren})`).join(', '));

fs.writeFileSync('./kosodate_data.json', JSON.stringify(kosodateData, null, 0), 'utf-8');
console.log('kosodate_data.json 生成完了');
