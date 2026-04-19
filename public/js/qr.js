function generateQRCode(url, container) {
    return new Promise(resolve => {
        const qr = new QRCode(container, {
        	text: url, 
        	width: 128, 
        	height: 128,
	        colorDark: "#000000",
			colorLight: "#ffffff",
			correctLevel: QRCode.CorrectLevel.H
		});

        const checkCanvas = setInterval(() => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                clearInterval(checkCanvas);

                // Convert canvas to <img> for PDF
                const img = document.createElement('img');
                img.src = canvas.toDataURL();
                img.width = canvas.width;
                img.height = canvas.height;
                container.innerHTML = '';
                container.appendChild(img);

                resolve();
            }
        }, 10);
    });
}