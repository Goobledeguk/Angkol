export const adminDashboardStyles = `
.angkol-admin{--green:#0b4f3c;--ink:#263a34;--muted:#7c8e87;--line:#e0e9e4;display:flex;height:100%;min-height:0;background:#f2f6f3;color:var(--ink);font:13px/1.55 "Archivo",-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.angkol-admin *{box-sizing:border-box}.angkol-admin button,.angkol-admin input,.angkol-admin select{font:inherit}.angkol-admin button{cursor:pointer}.angkol-admin button:disabled{opacity:.5;cursor:wait}.angkol-admin button:focus-visible,.angkol-admin input:focus-visible,.angkol-admin select:focus-visible{outline:2px solid #e3aa40;outline-offset:3px}
.aa-sidebar{width:226px;flex-shrink:0;background:#073e32;color:#c2d8ce;padding:30px 18px;display:flex;flex-direction:column;gap:30px}.aa-brand{display:flex;align-items:center;gap:10px;font-size:21px;font-weight:750;color:white;padding:0 10px}.aa-brandmark{display:grid;place-items:center;width:32px;height:34px;background:white;border-radius:9px;color:#08634d}.aa-nav{display:flex;flex-direction:column;gap:7px}.aa-nav button{border:0;background:none;color:inherit;display:flex;align-items:center;gap:12px;text-align:left;padding:13px 12px;border-radius:9px;font-size:12px}.aa-nav button[aria-current=page]{background:#ffffff18;color:white;font-weight:650}.aa-nav button:hover{background:#ffffff12}.aa-user{display:flex;align-items:center;gap:9px;background:#ffffff12;border:0;border-radius:9px;color:white;padding:12px 10px;text-align:left}.aa-user b{display:block;font-size:11px}.aa-user small{display:block;color:#a1bcb0;font-size:10px}.aa-avatar{display:grid;place-items:center;flex-shrink:0;width:33px;height:33px;background:#ffb644;color:#1c4937;border-radius:50%;font-weight:700;font-size:11px}
.aa-main{flex:1;min-width:0;overflow:auto;padding:28px 30px 44px}.aa-inner{max-width:1500px;margin:auto}.aa-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px}.aa-header h1{font-size:27px;font-weight:450;letter-spacing:-.5px;margin:0 0 3px}.aa-muted,.aa-header p{color:var(--muted);font-size:11px;margin:0}.aa-headtools{display:flex;align-items:center;gap:10px;padding-top:4px}.aa-date{display:flex;align-items:center;gap:7px;font-size:11px;color:#72867c;white-space:nowrap}.aa-iconbutton{display:grid;place-items:center;position:relative;background:white;border:1px solid var(--line);border-radius:9px;color:var(--green);width:36px;height:36px}.aa-dot{position:absolute;right:5px;top:5px;border:2px solid white;background:#ffae40;width:9px;height:9px;border-radius:50%}
.aa-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:24px}.aa-stat{position:relative;background:white;border:1px solid var(--line);border-radius:17px;padding:23px 17px 16px;min-height:134px}.aa-statlabel{font-size:10px;color:#7b8d84;text-transform:uppercase;letter-spacing:.15px;padding-right:28px}.aa-statvalue{font-size:29px;font-weight:450;line-height:1.3;margin:13px 0 8px;letter-spacing:-.8px}.aa-statnote{font-size:10px;color:var(--green)}.aa-stat-icon{position:absolute;right:16px;top:17px;display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:#edf7f1;color:var(--green)}.aa-stat.blue .aa-stat-icon{background:#e8f2fc;color:#277ec3}.aa-stat.amber .aa-stat-icon{background:#fff2dd;color:#f4a22c}.aa-stat.red .aa-stat-icon{background:#ffebe7;color:#ed7566}.aa-stat.blue .aa-statnote{color:#277ec3}.aa-stat.amber .aa-statnote{color:#efa43c}.aa-stat.red .aa-statnote{color:#ea7868}
.aa-grid{display:grid;gap:16px;margin-bottom:18px;align-items:start}.aa-grid.equal{grid-template-columns:1.1fr 1fr}.aa-grid.split{grid-template-columns:minmax(0,2.6fr) minmax(250px,1fr)}.aa-grid.routes{grid-template-columns:minmax(0,1.9fr) minmax(280px,1fr)}.aa-panel{background:white;border:1px solid var(--line);border-radius:17px;padding:18px;min-width:0}.aa-panelhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.aa-panelhead h2{font-size:14px;font-weight:500;margin:0}.aa-panelhead p{font-size:10px;color:var(--muted);margin:3px 0 0}.aa-pill{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;padding:4px 9px;border-radius:15px;font-size:10px;background:#ddf0e7;color:var(--green);border:0}.aa-pill.gray{background:#f4f7f4;color:#7b8e84}.aa-pill.amber{background:#fff1da;color:#bc8a3d}.aa-pill.red{background:#ffe9e5;color:#e27668}.aa-pill.blue{background:#e7f2fd;color:#3886c4}.aa-toolbar{display:flex;justify-content:space-between;gap:16px;align-items:center;margin:0 0 20px}.aa-tabs{display:flex;gap:6px;flex-wrap:wrap}.aa-tabs button{border:0}.aa-controls{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.aa-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:10px;padding:12px 14px;background:var(--green);color:white;font-size:12px;font-weight:600;text-decoration:none}.aa-button.light{background:#edf6f1;color:var(--green)}.aa-button.plain{background:transparent;color:var(--green);padding:6px}.aa-search{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:white;border-radius:10px;padding:9px 11px;color:#71877b}.aa-search input{border:0;outline:none;background:transparent;width:180px;max-width:100%;color:var(--ink);font-size:11px}.aa-search input::placeholder{color:#98a79e}.aa-select{border:1px solid var(--line);background:#fff;color:#60776b;border-radius:8px;padding:7px 9px;font-size:11px!important}
.aa-tablewrap{overflow:auto}.aa-table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:10px}.aa-table th{background:#f6f9f6;text-align:left;font-size:9px;font-weight:600;letter-spacing:.25px;color:#7d8e84;padding:11px 10px;text-transform:uppercase}.aa-table td{border-bottom:1px solid #e8eeea;padding:14px 10px;color:#73877b}.aa-table td strong{color:#354e42;font-weight:550}.aa-table tbody tr:last-child td{border-bottom:0}.aa-table tbody tr[data-clickable]{cursor:pointer}.aa-table tbody tr[data-clickable]:hover{background:#f5f9f6}.aa-person{display:flex;gap:10px;align-items:center}.aa-person .aa-avatar{background:#eaf5ef;width:31px;height:31px;color:#789889;font-size:10px}.aa-person small{display:block;font-size:9px;color:#9aa79f}.aa-person b{color:#365446;font-weight:600}.aa-online{color:#087253}.aa-online::before{content:'●';font-size:9px;margin-right:6px}.aa-offline::before{content:'●';font-size:9px;color:#a0aea6;margin-right:6px}.aa-empty{padding:32px 12px!important;text-align:center;color:#8c9d92!important;white-space:normal}.aa-list{display:grid;gap:10px}.aa-listitem{display:flex;justify-content:space-between;gap:10px;align-items:center;border:0;border-radius:9px;background:#f6f9f6;padding:12px;text-align:left;color:var(--ink);width:100%;font-size:11px}.aa-listitem strong{display:block;font-size:11px;font-weight:550}.aa-listitem small{display:block;color:#91a197;font-size:10px;margin-top:3px}.aa-policy{border-radius:10px;background:#edf7f1;padding:12px;font-size:10px;color:#5c907c;margin-top:14px}.aa-policy strong{display:flex;gap:6px;align-items:center;margin-bottom:5px}.aa-policy.amber{background:#fff2dc;color:#a78650}.aa-schedule{display:flex;align-items:center;gap:18px;padding:12px 6px;border-bottom:1px solid #f1f5f1}.aa-schedule:last-child{border:0}.aa-schedule time{color:var(--green);font-size:11px;font-weight:650}.aa-schedule strong{font-size:11px;display:block}.aa-schedule small{color:var(--muted);font-size:10px}.aa-schedule>div{flex:1}.aa-chart{height:222px;display:flex;gap:10px;align-items:flex-end;padding:22px 4px 2px}.aa-barcol{flex:1 1 0;min-width:28px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:8px}.aa-bar{background:#dcefe6;border-radius:5px 5px 0 0;width:100%;max-width:38px;min-height:2px}.aa-barcol:nth-last-child(-n+4) .aa-bar{background:#09634d}.aa-barcol span{font-size:9px;color:#9aaca0}.aa-meter{margin:16px 0}.aa-meterhead{display:flex;justify-content:space-between;font-size:10px;color:#83978b;margin-bottom:6px}.aa-meterhead b{color:#365346}.aa-track{background:#f2f6f3;height:6px;border-radius:6px;overflow:hidden}.aa-track>div{height:100%;border-radius:6px;background:#08634d}.aa-fares{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;min-width:0}.aa-fare{padding:14px;background:#f5f8f5;border-radius:10px;text-align:left;border:0;color:var(--ink)}.aa-fare strong{display:block;font-size:11px}.aa-fare b{display:block;color:var(--green);font-size:22px;margin:3px 0;overflow-wrap:anywhere}.aa-fare small{display:block;color:#97a99d;font-size:9px}.aa-map>div{height:226px!important;border-radius:8px!important}.aa-alert{padding:12px;border-radius:10px;background:#fff4df;color:#9b773a;margin-bottom:18px;display:flex;justify-content:space-between;gap:12px;font-size:12px}.aa-alert button{border:0;background:none;color:inherit}.aa-overlay{position:fixed;inset:0;background:#082c2466;z-index:1000;display:flex;align-items:center;justify-content:center;padding:28px}.aa-dialog{position:relative;background:#f3f7f3;border-radius:20px;padding:28px;width:min(760px,100%);max-height:90vh;overflow:auto;box-shadow:0 25px 100px #002b3933}.aa-dialoghead{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px}.aa-dialoghead h2{font-size:21px;font-weight:500;margin:0}.aa-dialog dl{display:grid;grid-template-columns:150px 1fr;gap:12px;font-size:13px}.aa-dialog dt{color:var(--muted)}.aa-dialog dd{margin:0;overflow-wrap:anywhere}.aa-formstack{display:grid;gap:14px}.aa-dialog .aa-button{justify-self:start}.aa-dialog p{color:#7d9085}.aa-modal-list{padding:15px;background:white;border-radius:10px;margin-bottom:10px}.aa-modal-list p{color:var(--ink);margin:0 0 8px}.aa-statusrow{display:flex;justify-content:space-between;gap:18px;padding:15px 0;border-bottom:1px solid var(--line);align-items:center;font-size:11px}.aa-statusrow:last-child{border:0}
@media(min-width:1700px){.aa-main{padding:36px 40px}.aa-sidebar{width:240px}}@media(max-width:1100px){.aa-sidebar{width:190px;padding:24px 12px}.aa-main{padding:24px 20px}.aa-grid.split{grid-template-columns:minmax(0,1.9fr) minmax(225px,1fr)}.aa-search input{width:130px}.aa-stat{padding:20px 13px 14px}.aa-statlabel{font-size:9px}.aa-table td,.aa-table th{padding-left:7px;padding-right:7px}}@media(max-width:850px){.aa-sidebar{width:165px}.aa-brand{font-size:18px}.aa-main{padding:22px 16px}.aa-header h1{font-size:23px}.aa-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.aa-grid.equal,.aa-grid.split,.aa-grid.routes{grid-template-columns:1fr}.aa-fares{grid-template-columns:repeat(2,minmax(0,1fr))}.aa-toolbar{flex-wrap:wrap}}@media(max-width:560px){.angkol-admin{flex-direction:column}.aa-sidebar{width:100%;padding:12px;gap:12px}.aa-brand{padding:0}.aa-nav{flex-direction:row;overflow:auto;gap:4px}.aa-nav button{white-space:nowrap;padding:9px;font-size:10px}.aa-nav button svg{display:none}.aa-user{display:none}.aa-header{flex-wrap:wrap}.aa-main{padding:18px 12px}.aa-header h1{font-size:22px}.aa-stats{gap:8px}.aa-statvalue{font-size:25px}.aa-dialog{padding:20px}.aa-overlay{padding:12px}}

/* Shared premium finish. Layout and navigation remain unchanged. */
.angkol-admin{--ink:#18382c;--muted:#62766b;--line:#dfe9e1;background:#ffffff}
.angkol-admin .aa-sidebar{background:#06392d;box-shadow:4px 0 24px #06392d14}
.angkol-admin .aa-nav button{min-height:48px}
.angkol-admin .aa-user{margin-top:auto;border:1px solid #ffffff20}
.angkol-admin .aa-nav button{border-radius:13px;transition:background .15s ease}
.angkol-admin .aa-nav button[aria-current=page]{background:#ffffff;color:#0b4f3c;font-weight:700}
.angkol-admin .aa-heading{display:flex;align-items:center;gap:14px;min-width:0}
.angkol-admin .aa-header{padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:26px}
.angkol-admin .aa-header h1{font-size:28px;font-weight:750;letter-spacing:-.8px;color:var(--ink)}
.angkol-admin .aa-panel,.angkol-admin .aa-stat{border-radius:22px;border-color:var(--line);box-shadow:0 4px 18px #072c1f0b}
.angkol-admin .aa-panel{padding:24px}
.angkol-admin .aa-table{font-size:11px}
.angkol-admin .aa-header p{font-size:12px}
.angkol-admin .aa-panelhead h2{font-size:16px;font-weight:700;letter-spacing:-.3px}
.angkol-admin .aa-stat{padding:24px 20px;min-height:156px;border-top:3px solid #b6d8c3;min-width:0;overflow:hidden}
.angkol-admin .aa-stat.blue{border-top-color:#aed1e8}.angkol-admin .aa-stat.amber{border-top-color:#e9c682}.angkol-admin .aa-stat.red{border-top-color:#e9b1a7}
.angkol-admin .aa-statlabel{font-size:10px;letter-spacing:.7px;font-weight:650;color:var(--muted)}
.angkol-admin .aa-statvalue{font-size:34px;font-weight:700;letter-spacing:-1.1px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;word-break:break-word;min-width:0}
.angkol-admin .aa-table th{background:#f2f6f3;color:#62766b;font-size:10px;letter-spacing:.5px}
.angkol-admin .aa-table td{padding-top:16px;padding-bottom:16px;border-color:#edf1ee}
.angkol-admin .aa-button{border-radius:13px;min-height:44px;font-weight:700;transition:opacity .15s ease}
.angkol-admin .aa-button:active{opacity:.76}
.angkol-admin .aa-search{border-radius:13px;padding:11px 13px;background:#f7f9f7}
.angkol-admin .aa-search:focus-within{border-color:var(--green)}
.angkol-admin .aa-listitem{background:#f4f7f5;border-radius:14px;padding:15px}
.angkol-admin .aa-pill{font-weight:650}
@media(max-width:560px){.angkol-admin .aa-header h1{font-size:23px}.angkol-admin .aa-stat{padding:18px 14px}.angkol-admin .aa-statvalue{font-size:28px}.angkol-admin .aa-panel{padding:16px}}
@media(prefers-reduced-motion:reduce){.angkol-admin button{transition:none}}

/* Popover delay 0.95s and confirmation button pulsing */
.aa-popover, .aa-tooltip, [data-popover] {
  animation: aaFadeIn 0.25s ease-out 0.95s both;
  transition-delay: 0.95s;
}
@keyframes aaFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes aaPulseConfirm {
  0% { transform: scale(1); }
  40% { transform: scale(0.95); box-shadow: 0 0 0 6px rgba(11, 79, 60, 0.25); }
  75% { transform: scale(1.03); box-shadow: 0 0 0 12px rgba(11, 79, 60, 0); }
  100% { transform: scale(1); }
}
.aa-confirm-pulsing {
  animation: aaPulseConfirm 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.aa-pill-btn {
  border: 1px solid var(--line);
  background: white;
  border-radius: 9px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
}
.aa-pill-btn.active {
  background: #edf7f1;
  color: var(--green);
  border-color: #b8dcce;
}
.aa-badge-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.aa-badge-status.arrived { background: #e6f6ee; color: #086b4f; }
.aa-badge-status.terminal { background: #eaf1fb; color: #1f64b4; }
.aa-badge-status.broken { background: #fdeee9; color: #c43217; }
.aa-badge-status.transit { background: #fef7e7; color: #b57a17; }



/* Ledger finish: paper ground, hairline panels, numbers first. */
.angkol-admin{--paper:#f6f4ee;--ink:#13201a;--muted:#5a675f;--line:#e2ded3;--brass:#c69c57;background:var(--paper)}
.angkol-admin .aa-sidebar{background:#0a2e23;box-shadow:none}
.angkol-admin .aa-nav button[aria-current=page]{background:#ffffff14;color:#fff;box-shadow:inset 0 0 0 1px #ffffff26}
.angkol-admin .aa-avatar{background:var(--brass);color:#13201a}
.angkol-admin .aa-header{border-bottom-color:var(--line)}
.angkol-admin .aa-header h1{font-weight:800;letter-spacing:-1px}
.angkol-admin .aa-panel,.angkol-admin .aa-stat{border-radius:12px;box-shadow:none;border-color:var(--line);background:#fff}
.angkol-admin .aa-stat{border-top:1px solid var(--line);min-height:0;padding:18px 18px 16px}
.angkol-admin .aa-stat-icon{display:none}
.angkol-admin .aa-statlabel{text-transform:none;letter-spacing:0;font-size:12px;font-weight:600;padding-right:0}
.angkol-admin .aa-statvalue{font-size:32px;font-weight:800;letter-spacing:-1.2px;margin:6px 0 4px;color:var(--ink)}
.angkol-admin .aa-statnote,.angkol-admin .aa-stat.blue .aa-statnote,.angkol-admin .aa-stat.amber .aa-statnote,.angkol-admin .aa-stat.red .aa-statnote{color:var(--muted);font-size:11px}
.angkol-admin .aa-stat.amber .aa-statvalue{color:#a9772c}.angkol-admin .aa-stat.red .aa-statvalue{color:#b3411f}
.angkol-admin .aa-panelhead p{font-size:11px}
.angkol-admin .aa-table{font-variant-numeric:tabular-nums}
.angkol-admin .aa-table th{background:transparent;text-transform:none;letter-spacing:0;font-size:11px;font-weight:700;color:var(--muted);border-bottom:1px solid var(--line)}
.angkol-admin .aa-table td{border-color:#eeebe3;color:#4b5952}
.angkol-admin .aa-table td strong,.angkol-admin .aa-person b{color:var(--ink)}
.angkol-admin .aa-table tbody tr[data-clickable]:hover{background:#faf9f5}
.angkol-admin .aa-person .aa-avatar{background:#ece9e1;color:var(--ink)}
.angkol-admin .aa-pill,.angkol-admin .aa-badge-status{background:transparent!important;padding:0;border-radius:0;font-weight:700;font-size:11px}
.angkol-admin .aa-pill::before,.angkol-admin .aa-badge-status::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;flex-shrink:0}
.angkol-admin .aa-pill.gray{color:var(--muted)}.angkol-admin .aa-pill.amber,.angkol-admin .aa-badge-status.transit{color:#a9772c}.angkol-admin .aa-pill.red,.angkol-admin .aa-badge-status.broken{color:#b3411f}.angkol-admin .aa-pill.blue,.angkol-admin .aa-badge-status.terminal{color:#2f5f8a}
.angkol-admin .aa-button{border-radius:10px}
.angkol-admin .aa-button.light{background:#fff;box-shadow:inset 0 0 0 1px var(--line)}
.angkol-admin .aa-search{background:#fff;border-radius:10px}
.angkol-admin .aa-listitem{background:#faf9f5;border:1px solid #eeebe3;border-radius:10px}
.angkol-admin .aa-policy{background:transparent;padding:0;color:var(--muted)}
.angkol-admin .aa-policy.amber{color:#a9772c}
.angkol-admin .aa-fare{background:#faf9f5;border:1px solid #eeebe3}
.angkol-admin .aa-fare b{color:var(--ink);font-variant-numeric:tabular-nums}
.angkol-admin .aa-bar{background:#dcd8cc;border-radius:3px 3px 0 0}
.angkol-admin .aa-barcol:last-child .aa-bar{background:#0b4f3c}
.angkol-admin .aa-barcol:nth-last-child(-n+4):not(:last-child) .aa-bar{background:#9fb3a7}
.angkol-admin .aa-track{background:#ece9e1}.angkol-admin .aa-track>div{background:var(--ink)}
.angkol-admin .aa-pill-btn{border-radius:8px}.angkol-admin .aa-pill-btn.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.angkol-admin .aa-dialog{background:var(--paper);border-radius:14px}
.angkol-admin .aa-alert{background:#fff;border:1px solid #e9d7b6;color:#7a5520}
.angkol-admin ::selection{background:#c69c5755}

/* Signboard: jeepney-board lettering, ink and tricycle yellow. */
.angkol-admin{--ink:#14201A;--muted:#5c625e;--line:#e1e2dd;--paper:#ffffff;--yellow:#ffc20e;--green:#14201A;background:#fff;font-family:"Archivo",sans-serif}
.angkol-admin .aa-sidebar{background:#14201A;color:#b9bdb8}
.angkol-admin .aa-nav button[aria-current=page]{background:var(--yellow);color:#14201A;box-shadow:none;font-weight:700}
.angkol-admin .aa-header{border-bottom:3px solid var(--ink)}
.angkol-admin .aa-header h1{font-family:"ArchivoBoard",sans-serif;font-weight:400;text-transform:uppercase;font-size:44px;line-height:1;letter-spacing:.2px}
.angkol-admin .aa-panel,.angkol-admin .aa-stat{background:#f2f2ee;border:0;border-radius:10px}
.angkol-admin .aa-stat{border-top:0}
.angkol-admin .aa-statlabel,.angkol-admin .aa-table th,.angkol-admin .aa-panelhead h2{font-family:"ArchivoCond",sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.8px}
.angkol-admin .aa-panelhead h2{font-size:15px}
.angkol-admin .aa-statvalue{font-family:"ArchivoBoard",sans-serif;font-weight:400;font-size:48px;line-height:1;letter-spacing:0;margin:8px 0 4px}
.angkol-admin .aa-stat.amber .aa-statvalue{color:#946000}
.angkol-admin .aa-table td{border-color:#e1e2dd}
.angkol-admin .aa-button{background:var(--yellow);color:#14201A;border-radius:8px;font-family:"ArchivoCond",sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.6px;font-size:14px}
.angkol-admin .aa-button.light{background:#fff;box-shadow:inset 0 0 0 2px #14201A}
.angkol-admin .aa-button.plain{background:transparent}
.angkol-admin .aa-search{border:2px solid #14201A;border-radius:8px}
.angkol-admin .aa-listitem,.angkol-admin .aa-fare{background:#fff;border:0}
.angkol-admin .aa-fare b{font-family:"ArchivoBoard",sans-serif;font-weight:400;font-size:30px}
.angkol-admin .aa-barcol:last-child .aa-bar{background:var(--yellow)}
.angkol-admin .aa-bar,.angkol-admin .aa-barcol:nth-last-child(-n+4):not(:last-child) .aa-bar{background:#14201A}
.angkol-admin .aa-pill-btn.active{background:#14201A;color:#fff}
.angkol-admin .aa-avatar{background:var(--yellow)}
.angkol-admin ::selection{background:#ffc20e88}

/* Discipline pass: condensed face only for figures; sentence case elsewhere; one grid. */
.angkol-admin .aa-header h1{font-family:"Archivo",sans-serif;font-weight:700;text-transform:none;font-size:32px;letter-spacing:-.4px}
.angkol-admin .aa-statlabel,.angkol-admin .aa-table th,.angkol-admin .aa-panelhead h2{font-family:"Archivo",sans-serif;font-weight:700;text-transform:none;letter-spacing:0}
.angkol-admin .aa-statlabel{font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px}
.angkol-admin .aa-stat.red .aa-statlabel::before,.angkol-admin .aa-stat.amber .aa-statlabel::before{content:"";width:9px;height:9px;flex-shrink:0}
.angkol-admin .aa-stat.red .aa-statlabel::before{background:#c8321b}
.angkol-admin .aa-stat.amber .aa-statlabel::before{background:#ffc20e;box-shadow:inset 0 0 0 1.5px #14201A}
.angkol-admin .aa-statvalue,.angkol-admin .aa-stat.amber .aa-statvalue,.angkol-admin .aa-stat.red .aa-statvalue{color:#14201A}
.angkol-admin .aa-button{font-family:"Archivo",sans-serif;font-weight:700;text-transform:none;letter-spacing:0;font-size:13px}
.angkol-admin .aa-table td,.angkol-admin .aa-person b{text-transform:none}
.angkol-admin .aa-stats,.angkol-admin .aa-grid{gap:16px}
.angkol-admin .aa-grid.split,.angkol-admin .aa-grid.routes{grid-template-columns:minmax(0,3fr) minmax(0,1fr)}
.angkol-admin .aa-grid.equal{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.angkol-admin .aa-grid.queue-first{grid-template-columns:minmax(0,1fr) minmax(0,3fr)}
.angkol-admin .aa-grid.queue-first>:last-child{order:-1}
.angkol-admin .aa-hours{display:flex;align-items:flex-end;gap:4px;height:64px;padding-top:6px}
.angkol-admin .aa-hour{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}
.angkol-admin .aa-hour i{display:block;width:100%;background:#14201A;border-radius:2px}
.angkol-admin .aa-hour.now i{background:#ffc20e;box-shadow:inset 0 0 0 1.5px #14201A;min-height:18px}
.angkol-admin .aa-hour span{font-size:10px;line-height:12px;height:12px;color:#4f5551;font-variant-numeric:tabular-nums}
@media(max-width:850px){.angkol-admin .aa-grid.queue-first{grid-template-columns:1fr}}

/* Readability floor and quiet surfaces: hairline panels, 13px minimum, no coloured brand tile. */
.angkol-admin{font-size:14px}
.angkol-admin .aa-panel,.angkol-admin .aa-stat{background:#fff;border:1px solid var(--line)}
.angkol-admin .aa-listitem,.angkol-admin .aa-fare{background:#fff;border:1px solid var(--line)}
.angkol-admin .aa-nav button{font-size:14px}
.angkol-admin .aa-nav button[aria-current=page]{background:#fff;color:#14201A}
.angkol-admin .aa-brandmark{background:#fff;color:#14201A}
.angkol-admin .aa-user b{font-size:13px}.angkol-admin .aa-user small{font-size:12px}
.angkol-admin .aa-header p,.angkol-admin .aa-date,.angkol-admin .aa-panelhead p{font-size:13px}
.angkol-admin .aa-table{font-size:13px}
.angkol-admin .aa-table th{font-size:12px}
.angkol-admin .aa-person small,.angkol-admin .aa-statnote{font-size:12px}
.angkol-admin .aa-listitem,.angkol-admin .aa-listitem strong{font-size:14px}
.angkol-admin .aa-listitem small,.angkol-admin .aa-schedule small,.angkol-admin .aa-fare small,.angkol-admin .aa-policy,.angkol-admin .aa-meterhead{font-size:12px}
.angkol-admin .aa-schedule strong,.angkol-admin .aa-schedule time,.angkol-admin .aa-fare strong{font-size:13px}
.angkol-admin .aa-pill,.angkol-admin .aa-badge-status{font-size:12px}
.angkol-admin .aa-search input,.angkol-admin .aa-select{font-size:13px!important}
.angkol-admin .aa-hour span{font-size:11px}
.angkol-admin .aa-hour.now i{background:#14201A;box-shadow:none}
.angkol-admin .aa-hour i{background:#9a9e9a}
.angkol-admin .aa-dot{background:#c8321b;border-color:#fff}
/* Brand green: the app icon's #0F5D45 carries actions and the current selection; neutrals lean green. */
.angkol-admin{--brand:#0F5D45;--brand-deep:#0A4434;--brand-soft:#E4EFE9;--ink:#14201A;--muted:#56625B;--line:#DCE4DF}
.angkol-admin .aa-sidebar{background:var(--brand-deep);color:#B9D3C5}
.angkol-admin .aa-nav button[aria-current=page]{background:#fff;color:var(--brand)}
.angkol-admin .aa-brandmark{background:#fff;color:var(--brand)}
.angkol-admin .aa-button{background:var(--brand);color:#fff;font-family:"Archivo",sans-serif;font-weight:600;text-transform:none;letter-spacing:0}
.angkol-admin .aa-button.light{background:#fff;color:var(--brand);box-shadow:inset 0 0 0 1.5px var(--brand)}
.angkol-admin .aa-search{border:1.5px solid #C5D0C9}
.angkol-admin .aa-pill-btn.active{background:var(--brand);color:#fff}
.angkol-admin .aa-avatar{background:var(--brand-soft);color:var(--brand)}
.angkol-admin ::selection{background:#0F5D4533}
.angkol-admin .aa-stat.amber .aa-statlabel::before{background:#946000;box-shadow:none}
.angkol-admin .aa-bar,.angkol-admin .aa-barcol:nth-last-child(-n+4):not(:last-child) .aa-bar{background:#AFC6B9}
.angkol-admin .aa-barcol:last-child .aa-bar{background:var(--brand)}
.angkol-admin .aa-hour i{background:#AFC6B9}
.angkol-admin .aa-hour.now i{background:var(--brand);box-shadow:none}

/* Profile circles and long text: keep names/values inside the frame. */
.angkol-admin .aa-avatar{overflow:hidden;padding:0;flex:0 0 auto;aspect-ratio:1}
.angkol-admin .aa-avatar img{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%}
.angkol-admin .aa-inner,.angkol-admin .aa-panel,.angkol-admin .aa-grid>*{min-width:0}
.angkol-admin .aa-user>span:not(.aa-avatar){min-width:0;flex:1}
.angkol-admin .aa-user b,.angkol-admin .aa-user small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.angkol-admin .aa-person{min-width:0;max-width:100%}
.angkol-admin .aa-person>span{min-width:0;overflow:hidden}
.angkol-admin .aa-person b,.angkol-admin .aa-person small{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.angkol-admin .aa-listitem>span{min-width:0}
.angkol-admin .aa-listitem strong,.angkol-admin .aa-listitem small{overflow-wrap:anywhere}
.angkol-admin .aa-dialog{max-height:calc(100vh - 32px);overflow:auto}
.angkol-admin .aa-dialog dd{overflow-wrap:anywhere}
.angkol-admin .aa-formstack p{overflow-wrap:anywhere}

/* Schedule rows shrink the middle column instead of squeezing route names. */
.angkol-admin .aa-schedule{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 14px;align-items:center}
.angkol-admin .aa-schedule time{white-space:nowrap}
.angkol-admin .aa-schedule>div{min-width:0}
.angkol-admin .aa-schedule strong,.angkol-admin .aa-schedule small{overflow-wrap:anywhere}
.angkol-admin .aa-schedule .aa-pill{justify-self:end}
@media(max-width:560px){
  .angkol-admin .aa-schedule{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"time status" "route route";gap:4px 10px}
  .angkol-admin .aa-schedule time{grid-area:time}
  .angkol-admin .aa-schedule>div{grid-area:route}
  .angkol-admin .aa-schedule .aa-pill{grid-area:status}
}

/* Account actions sit side by side. */
.angkol-admin .aa-accountactions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.angkol-admin .aa-accountactions .aa-button{justify-self:auto}
`;
