

let deckRegex = /encoredecks.com\/deck\/(.+)/;
let inputBox = document.getElementById('deckInput');
let outputBox = document.getElementById('output-link');


let genUrl = (deckId) => {
  let rootUrl = window.location.href;
  return rootUrl+'deck/'+deckId;
}


let updateOutputBox = () => {
  let match = deckRegex.exec(inputBox.value)
  if (match !== null) {
    let deckId = match[1];
    outputBox.innerText = genUrl(deckId);
    outputBox.href = genUrl(deckId);
  }
}

inputBox.addEventListener('input', updateOutputBox);
