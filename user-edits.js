(() => {
  'use strict';
  const patch = {"guides":{"siege-tue-aileen-basic":{"rows":{"3":{"hero":"미호","formation":"앞줄","weapon":["복수자 치명타확률","복수자 치명타피해"],"armor":["복수자 모든공격력(%)","복수자 모든공격력(%)"],"accessory":"토벌 + 공성 (치확)(약확)","alternative":"","sub":"치명타 확률 73%\n치명타 피해 최대한\n약점공격확률 47% \n모든 공격력 최대한","speed":"5순위","comment":"","colors":{}}}},"siege-wed-rachel-orly":{"variant":"루리 버전","rows":{"3":{"hero":"미호","formation":"뒷줄","weapon":["복수자 치명타확률","복수자 치명타피해"],"armor":["복수자 모든공격력(%)","복수자 모든공격력(%)"],"accessory":"토벌 + 공성 (치확)(약확)","alternative":"","sub":"치확100% 근접\n치명타 피해 최대한\n약점공격확률 47% \n모든 공격력 최대한","speed":"4~5순위","comment":"4초 시 약공 확률 20%만 부옵으로 30% 챙기면 됨","colors":{}}}},"siege-wed-rachel-nata":{"variant":"나타 고점(웬만하면 이거 써)"},"siege-wed-rachel-rina-stable":{"variant":"나타 저점","deleted":true},"siege-fri-jave-basic":{"rows":{"3":{"hero":"라이언","formation":"뒷줄","weapon":["복수자 치명타확률","복수자 치명타피해"],"armor":["복수자 모든공격력(%)","복수자 모든공격력(%)"],"accessory":"토벌 + 공성 (치확)(약확)\n권능","alternative":"","sub":"치명타 확률 70~100%\n치명타 피해 최대한\n약점공격확률 20% \n모든 공격력 최대한","speed":"4~5순위","comment":"약공 20%만 챙기면 됨 (비스킷 6초 시)","colors":{}}}},"siege-sun-kris-basic":{"rows":{"3":{"hero":"소교","formation":"앞줄","weapon":["복수자 치명타확률","복수자 치명타확률"],"armor":["복수자 모든공격력(%)","복수자 모든공격력(%)"],"accessory":"토벌 + 공성 (치확)","alternative":"","sub":"치명타 확률 70~100%\n치명타 피해 최대한\n약점공격확률 47% \n모든 공격력 최대한","speed":"4순위","comment":"비스킷 6초 시 약공47퍼만 챙기면 됨","colors":{"alternative":"#65b9a7"}}}},"raid-ruin-eye":{"rows":{"1":{"hero":"선란","formation":"앞줄","weapon":["복수자 치명타확률","복수자 치명타피해"],"armor":["복수자 모든공격력(%)","복수자 모든공격력(%)"],"accessory":"토벌 + 치확","alternative":"리나","sub":"치확 100%\n치피 최대한","speed":"","comment":"","colors":{}},"2":{"hero":"비스킷","formation":"앞줄","weapon":["수문장 생명력(%)","수문장 생명력(%)"],"armor":["수문장 받피감(%)","수문장 받피감(%)"],"accessory":"","alternative":"","sub":"","speed":"","comment":"","colors":{}},"3":{"hero":"지크","formation":"앞줄","weapon":["복수자 치명타확률","복수자 치명타피해"],"armor":["복수자 모든공격력(%)","복수자 모든공격력(%)"],"accessory":"토벌 + 공성 OR\n권능","alternative":"에반","sub":"","speed":"","comment":"","colors":{}},"4":{"hero":"백룡","formation":"뒷줄","weapon":["복수자 치명타피해","복수자 치명타피해"],"armor":["복수자 모든공격력(%)","복수자 모든공격력(%)"],"accessory":"토벌 + 공성 (약확)","alternative":"—세인","sub":"치확 67%\n약공 46%\n치피 최대한","speed":"","comment":"","colors":{}}}},"pvp-arena-01":{"variant":"1번 덱","rows":{"1":{"hero":"스쿨드","formation":"앞줄","weapon":["주술사 치명타 확률","주술사 치명타 확률"],"armor":["주술사 받는피해감소","주술사 받는피해감소"],"accessory":"권능 + 불사","alternative":"","sub":"치명타 확률 약 70%","speed":"최대한","comment":"","colors":{}}}},"pvp-attack-02":{"rows":{"0":{"hero":"오르카","formation":"앞줄","weapon":["암살자 OR 추적자 치확","암살자 OR 추적자 치확"],"armor":["암살자 OR 추적자 효저","암살자 OR 추적자 효저"],"accessory":"남는 장신구","alternative":"","sub":"효과 저항 100% 위주","speed":"최대한","comment":"효과 적중은 전용장비로 챙기기","colors":{}},"1":{"hero":"칼헤론","formation":"앞줄","weapon":["추적자 OR 주술사 치확","추적자 OR 주술사 치확"],"armor":["속공","속공"],"accessory":"남는 장신구","alternative":"","sub":"치명타 확률은 낮아도 무관","speed":"최대한","comment":"치명타 확률보다 속공이 더 중요","colors":{}}}}}};
  const byId = new Map((window.DEFAULT_DATA.guides || []).map(g => [g.id, g]));
  Object.entries(patch.guides || {}).forEach(([id, p]) => {
    const g = byId.get(id);
    if (!g) return;
    ['variant','title','group','boss','order','deleted','tags','heroes'].forEach(k => {
      if (Object.prototype.hasOwnProperty.call(p, k)) g[k] = p[k];
    });
    g.details ||= {};
    if (Object.prototype.hasOwnProperty.call(p, 'formationType')) g.details.formationType = p.formationType;
    Object.entries(p.rows || {}).forEach(([idx, row]) => {
      g.details.rows ||= [];
      g.details.rows[Number(idx)] = row;
    });
  });
  window.DEFAULT_DATA.version = 11;
})();


;(() => {
  const p = window.DEFAULT_DATA;
  if (!p) return;
  p.portraits ||= {};
  Object.assign(p.portraits, {
    "연희": "assets/portraits/custom/yeonhee.webp",
    "오르카": "assets/portraits/custom/orca.webp",
    "윤건": "assets/portraits/custom/yoongeon.webp",
    "하연": "assets/portraits/custom/hayeon.webp",
    "스쿨드": "assets/portraits/custom/skuld.webp",
    "동영": "assets/portraits/custom/dongyeong.webp"
  });
  (p.couponCodes || []).forEach(c => { c.note = ""; });
})();
