const scriptURL = 'https://script.google.com/macros/s/AKfycbyMLR2bdOlQMcl-W5vfSbb3N0JYn3kfs9JFeaL66N44NcVoVQHxcvUtxUkpKszspgzLpA/exec'

const form = document.forms['contact-form']

form.addEventListener('submit', e => {
  e.preventDefault()
  fetch(scriptURL, { method: 'POST', body: new FormData(form)})
  .then(response => alert("Thank you! The form was submited!" ))
  .then(() => { window.location.reload(); })
  .catch(error => console.error('Error!', error.message))
})