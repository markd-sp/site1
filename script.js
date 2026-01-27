// Display deployment timestamp
document.addEventListener('DOMContentLoaded', function() {
    const deploymentTime = document.getElementById('deployment-time');
    const now = new Date();
    deploymentTime.textContent = `Last deployed: ${now.toLocaleString()}`;
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
