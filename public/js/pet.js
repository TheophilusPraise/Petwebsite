// Replace form submission handler with this:
document.getElementById('addPetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Create URL-encoded data
  const formData = new URLSearchParams();
  formData.append('name', document.getElementById('petName').value);
  formData.append('species', document.getElementById('petSpecies').value);
  formData.append('breed', document.getElementById('petBreed').value);
  formData.append('age', document.getElementById('petAge').value);
  formData.append('image_url', document.getElementById('petImage').value);
  
  const response = await fetch('/user/pets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData.toString()
  });
  
  if (response.ok) {
    window.location.reload();
  } else {
    alert('Failed to add pet. Please try again.');
  }
});
