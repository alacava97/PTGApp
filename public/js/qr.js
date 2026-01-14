function generateQRCode(link) {
	document.getElementById('qrcode').innerHTML = '';

	new QRCode(document.getElementById('qrcode'), {
		text: link,
		width: 200,
		height: 200,
		colorDark: "#000000",
		colorLight: "#ffffff",
		correctLevel: QRCode.CorrectLevel.H
	});
}