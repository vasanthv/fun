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

(function () {
  var link = document.querySelector('link[rel="icon"]');
  var dark = window.matchMedia("(prefers-color-scheme: dark)");
  var paint = function () {
    link.href =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
          '<path fill="' +
          (dark.matches ? "#fff" : "#000") +
          '" d="M90 40L50 80L10 40L30 20L50 40L70 20L90 40Z"/>' +
          "</svg>",
      );
  };
  dark.addEventListener("change", paint);
  paint();
})();
