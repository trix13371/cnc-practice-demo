(function(root){
  'use strict';
  const ROUTE_VERSION=9;
  const sections={base:'cnc-practice-v2',course:'cnc-foundations-v1',coursePath:'cnc-course-path-v1',training:'cnc-deep-training-v2',gcode:'cnc-gcode-v2',skills:'cnc-skills-v1',library:'cnc-library-v1',lab:'cnc-lab-v1',routeExams:'cnc-route-exams-v1',machinePath:'cnc-machine-path-v1',learningPath:'cnc-learning-path-v1',sandbox:'cnc-sandbox-v1'};
  const historyKey='cnc-progress-history-v1',backupKey='cnc-progress-backup-v1',revisionKey='cnc-progress-revision-v1',journalKey='cnc-progress-transaction-v1';
  const legacy={training:'cnc-deep-training-v1',gcode:'cnc-gcode-v1'},navigation=['cnc-workspace-screen-v1','cnc-graphite-layout-v1'];
  const keys=[revisionKey,...Object.values(sections),...Object.values(legacy),...navigation,historyKey,backupKey];
  const api={ROUTE_VERSION,sections,legacy,navigation,historyKey,backupKey,revisionKey,journalKey,keys};
  root.CNCProgressConfig=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
