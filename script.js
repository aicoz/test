// script.js
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        window.close();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.3s ease';
        document.body.style.opacity = '1';
    }, 100);
});
