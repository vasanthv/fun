function getHighscore(gameId) {
  return parseInt(localStorage.getItem(`highscore:${gameId}`)) || 0;
}

function postHighscore(gameId, score) {
  const current = getHighscore(gameId);
  if (score > current) {
    localStorage.setItem(`highscore:${gameId}`, score);
    return score;
  }
  return current;
}

function initShareButton(getShareData) {
  document.getElementById("shareBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share(getShareData()).catch(() => {});
    } else {
      alert("Sharing is not supported on this browser.");
    }
  });
}
