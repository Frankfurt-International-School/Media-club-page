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
['ev-time', 'ev-end-time'].forEach(id => {
  document.getElementById(id).addEventListener('input', event => {
    if (!event.currentTarget.readOnly) event.currentTarget.dataset.manualValue = event.currentTarget.value;
  });
});
['ev-game1-start', 'ev-game2-end', 'ev-game3-end', 'ev-game4-end', 'ev-setup-start', 'ev-takedown-end'].forEach(id => {
  document.getElementById(id).addEventListener('input', syncEventBoundaryFields);
});
updateLivestreamSetupField();
window.finishCrewCenterStartup?.();
