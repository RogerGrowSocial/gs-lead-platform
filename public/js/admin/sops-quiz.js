(function () {
  const form = document.getElementById('sop-quiz-form');
  const resultEl = document.getElementById('sop-quiz-result');
  const resultTitle = document.getElementById('sop-quiz-result-title');
  const resultScore = document.getElementById('sop-quiz-result-score');

  if (!form || !resultEl) return;

  const sopId = form.getAttribute('data-sop-id');
  if (!sopId) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const answers = {};
    form.querySelectorAll('input[type="radio"]:checked').forEach(function (input) {
      const name = input.getAttribute('name');
      if (name && name.startsWith('q_')) {
        const qId = name.slice(2);
        answers[qId] = input.value;
      }
    });

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Bezig…';
    }

    try {
      const res = await fetch('/admin/sops/' + sopId + '/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (data.success) {
        resultTitle.textContent = data.passed ? 'Geslaagd!' : 'Nog niet geslaagd';
        resultScore.textContent = 'Score: ' + data.score_percent + '%. ' + (data.passed ? 'Je hebt de quiz gehaald.' : 'Je hebt minimaal 80% nodig. Lees de handleiding nog eens en probeer opnieuw.');
        resultEl.style.display = 'block';
        form.style.display = 'none';
      } else {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verstuur antwoorden'; }
        alert(data.error || 'Er ging iets mis.');
      }
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verstuur antwoorden'; }
      alert('Kon antwoorden niet versturen. Probeer het opnieuw.');
    }
  });
})();
