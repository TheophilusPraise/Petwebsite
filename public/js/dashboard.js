
        // Update year automatically
        document.getElementById('currentYear').textContent = new Date().getFullYear();
        
        // Mobile menu toggle
        document.getElementById('menu-btn').addEventListener('click', () => {
            document.querySelector('.navbar').classList.toggle('active');
        });
