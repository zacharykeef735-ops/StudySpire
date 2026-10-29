const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
test('planner scripts are wired into the app',()=>{
 const html=read('index.html');
 assert.match(html,/studyspire-planner\.js\?v=1/);
 assert.match(html,/studyspire-planner\.css\?v=1/);
 const css=read('studyspire-planner.css');
 assert.match(css,/@media\(max-width:700px\)/);
});
test('planner parses and exposes the launcher without a DOM session',()=>{
 const context={window:{},document:{readyState:'loading',addEventListener(){}}};
 vm.runInNewContext(read('studyspire-planner.js'),context,{timeout:1000});
 assert.equal(typeof context.window.StudySpirePlanner.open,'function');
});
test('planner backup, calendar, priority, and review operations exist',()=>{
 const js=read('studyspire-planner.js');
 for(const marker of ['function exportCalendar(', 'function renderInsights(', 'function renderReview(', 'function rank(', 'function validate(', 'function renderBackup('])
 assert.ok(js.includes(marker),'Missing '+marker);
 assert.match(js,/\.slice\(0,500\)/);
});
test('personal StudySpire has no organization or classroom integration',()=>{
 const html=read('index.html');
 assert.doesNotMatch(html,/school-(?:management|classroom)\.js/);
});
