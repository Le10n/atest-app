window.StorageService = (() => {
  const SETTINGS_KEY = 'atestCompanySettings';
  const PROJECT_KEY = 'atestCurrentProject';

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadSettings() {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  }

  function saveProject(project) {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  }

  function loadProject() {
    return JSON.parse(localStorage.getItem(PROJECT_KEY) || '{}');
  }

  function exportProject(project, filename) {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return {
    saveSettings,
    loadSettings,
    saveProject,
    loadProject,
    exportProject,
  };
})();