// goo.ne.jp から全47都道府県の子ども医療費助成（通院）データを取得
// → medical_aid_city.json を生成
const https = require('https');
const fs = require('fs');
const { TextDecoder } = require('util');

const PREFS = [
  { pref: '北海道',   romaji: 'hokkaido'  },
  { pref: '青森県',   romaji: 'aomori'    },
  { pref: '岩手県',   romaji: 'iwate'     },
  { pref: '宮城県',   romaji: 'miyagi'    },
  { pref: '秋田県',   romaji: 'akita'     },
  { pref: '山形県',   romaji: 'yamagata'  },
  { pref: '福島県',   romaji: 'fukushima' },
  { pref: '茨城県',   romaji: 'ibaragi'   },
  { pref: '栃木県',   romaji: 'tochigi'   },
  { pref: '群馬県',   romaji: 'gunma'     },
  { pref: '埼玉県',   romaji: 'saitama'   },
  { pref: '千葉県',   romaji: 'chiba'     },
  { pref: '東京都',   romaji: 'tokyo'     },
  { pref: '神奈川県', romaji: 'kanagawa'  },
  { pref: '新潟県',   romaji: 'niigata'   },
  { pref: '富山県',   romaji: 'toyama'    },
  { pref: '石川県',   romaji: 'ishikawa'  },
  { pref: '福井県',   romaji: 'fukui'     },
  { pref: '山梨県',   romaji: 'yamanashi' },
  { pref: '長野県',   romaji: 'nagano'    },
  { pref: '岐阜県',   romaji: 'gifu'      },
  { pref: '静岡県',   romaji: 'shizuoka'  },
  { pref: '愛知県',   romaji: 'aichi'     },
  { pref: '三重県',   romaji: 'mie'       },
  { pref: '滋賀県',   romaji: 'shiga'     },
  { pref: '京都府',   romaji: 'kyoto'     },
  { pref: '大阪府',   romaji: 'oosaka'    },
  { pref: '兵庫県',   romaji: 'hyougo'    },
  { pref: '奈良県',   romaji: 'nara'      },
  { pref: '和歌山県', romaji: 'wakayama'  },
  { pref: '鳥取県',   romaji: 'tottori'   },
  { pref: '島根県',   romaji: 'shimane'   },
  { pref: '岡山県',   romaji: 'okayama'   },
  { pref: '広島県',   romaji: 'hiroshima' },
  { pref: '山口県',   romaji: 'yamaguchi' },
  { pref: '徳島県',   romaji: 'tokushima' },
  { pref: '香川県',   romaji: 'kagawa'    },
  { pref: '愛媛県',   romaji: 'ehime'     },
  { pref: '高知県',   romaji: 'kouchi'    },
  { pref: '福岡県',   romaji: 'fukuoka'   },
  { pref: '佐賀県',   romaji: 'saga'      },
  { pref: '長崎県',   romaji: 'nagasaki'  },
  { pref: '熊本県',   romaji: 'kumamoto'  },
  { pref: '大分県',   romaji: 'ooita'     },
  { pref: '宮崎県',   romaji: 'miyazaki'  },
  { pref: '鹿児島県', romaji: 'kagoshima' },
  { pref: '沖縄県',   romaji: 'okinawa'   },
];

function fetchPage(romaji) {
  return new Promise((resolve, reject) => {
    const url = `https://house.goo.ne.jp/chiiki/kurashi/tsuuin/${romaji}.html`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      }
    };
    const req = https.get(url, options, (res) => {
      // リダイレクト対応
      if (res.statusCode === 301 || res.statusCode === 302) {
        resolve(fetchPageByUrl(res.headers.location));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(buf.toString('utf-8'));
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function fetchPageByUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };
    const req = https.get(url, options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
          resolve(buf.toString('utf-8'));
      });
    });
    req.on('error', reject);
  });
}

function parseAge(text) {
  if (!text) return null;
  text = text.trim();
  if (/18歳|高校卒業/.test(text)) return 18;
  if (/中学校?卒業|15歳年度末/.test(text)) return 15;
  if (/小学校?卒業|12歳年度末/.test(text)) return 12;
  if (/就学前/.test(text)) return 6;
  if (/9歳/.test(text)) return 9;
  const m = text.match(/(\d+)歳/);
  if (m) return parseInt(m[1]);
  return null;
}

// "XX市YY区" → "XX市"（政令市の区を市名に統合）
// "千代田区" などは変換しない（東京23区）
function normalizeName(raw) {
  const m = raw.match(/^(.+市)[^市]+区$/);
  if (m) return m[1];
  return raw;
}

function parsePage(html, pref) {
  const results = [];
  // HTML構造: <a href="/chiiki/kurashi/xxx/NNNNN.html">市区名</a> ... </th> <td>年齢テキスト</td>
  const rowRe = /<a\s+href="\/chiiki\/kurashi\/[^"]+\/\d+\.html">([^<]+)<\/a>[\s\S]*?<\/th>\s*<td[^>]*>([^<]*)<\/td>/g;
  let match;
  while ((match = rowRe.exec(html)) !== null) {
    const rawName = match[1].trim();
    const ageText = match[2].trim();
    const age = parseAge(ageText);
    if (!rawName || age === null) continue;
    const name = normalizeName(rawName);
    results.push({ pref, name, rawName, age });
  }
  return results;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const allRows = [];

  for (const { pref, romaji } of PREFS) {
    let retries = 0;
    while (retries < 3) {
      try {
        process.stdout.write(`  ${pref} ... `);
        const html = await fetchPage(romaji);
        const rows = parsePage(html, pref);
        console.log(`${rows.length}件`);
        allRows.push(...rows);
        break;
      } catch (e) {
        retries++;
        console.log(`ERROR (retry ${retries}): ${e.message}`);
        await sleep(2000);
      }
    }
    await sleep(400); // 丁寧なクロール間隔
  }

  // 同一 pref+name に複数の行がある場合は最大値を取る（区ごとに異なる場合の対処）
  const ageMap = {}; // "pref_name" → max age
  for (const r of allRows) {
    const key = `${r.pref}_${r.name}`;
    if (ageMap[key] === undefined || r.age > ageMap[key]) {
      ageMap[key] = r.age;
    }
  }

  const output = Object.entries(ageMap).map(([key, age]) => {
    const [pref, ...nameParts] = key.split('_');
    return { pref, name: nameParts.join('_'), age };
  });

  // 都道府県→市区名でソート
  output.sort((a, b) => {
    if (a.pref !== b.pref) return a.pref.localeCompare(b.pref, 'ja');
    return a.name.localeCompare(b.name, 'ja');
  });

  fs.writeFileSync('./medical_aid_city.json', JSON.stringify(output, null, 2), 'utf-8');

  // サマリー表示
  console.log(`\n=== 取得完了: ${output.length}件（${allRows.length}行から重複除去）===`);
  const dist = {};
  for (const r of output) {
    dist[r.age] = (dist[r.age] || 0) + 1;
  }
  console.log('年齢分布:', JSON.stringify(dist));

  // 都道府県別サンプル（確認用）
  const prefNames = [...new Set(output.map(r => r.pref))];
  console.log('\n都道府県別件数:');
  for (const p of prefNames) {
    const entries = output.filter(r => r.pref === p);
    const ages = [...new Set(entries.map(r => r.age))].sort((a,b)=>b-a).join('/');
    console.log(`  ${p}: ${entries.length}件 [${ages}歳]`);
  }
}

main().catch(console.error);
