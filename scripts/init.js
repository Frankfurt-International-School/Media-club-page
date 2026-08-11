// ══════════════════════════════
// INIT
// ══════════════════════════════
updateUserSurfaces();
openPageFromUrl();
requestAnimationFrame(initSlidingTabs);
window.addEventListener('resize', initSlidingTabs);
startWaveAnimation();
startBerlinClock();
setInterval(renderNotificationCenter, 60000);
document.getElementById('ev-date').addEventListener('change', () => {
  if (document.getElementById('ev-cat').value === 'Livestream') {
    document.getElementById('ev-livestream-setup-date').value = dateBefore(document.getElementById('ev-date').value);
  }
});
updateLivestreamSetupField();
loadCrewCenterData();
