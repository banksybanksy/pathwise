/**
 * Why:
 *   So a properly autheticated user can submit resources they want to share with others
 *   on the platform.
 *
 * What:
 *   We first check if the user is authenticated properly, take in a valid user input (as
 *   well as images if possible), and we package that into a formData. Afterwards we 
 *   submit the new resource. Then so the user can see the resource, we re-direct them to
 *   a page of the resource
 *
 * Where used:
 *   Its referenced/loaded by vertical-prototype/submit.html
 *
 * Notes:
 *   - Calls APIs: /api/resources so we can properly validate and update our database
 *   - On 401 error, we take the user to the login page
 *   - It allows multipart form as well as a optional picture to upload
 */

const submitForm = document.getElementById('submitForm');
const submitButton = document.getElementById('submitButton');
const submitError = document.getElementById('submit-error');
const submitSuccess = document.getElementById('submit-success');
const imageInput = document.getElementById('image');

function showSubmitMessage(element, message) {
  submitError.hidden = true;
  submitSuccess.hidden = true;
  element.textContent = message;
  element.hidden = false;
}

// Keep the submit request simple while matching the new moderation flow.
submitForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = document.getElementById('title').value.trim();
  const url = document.getElementById('url').value.trim();
  const description = document.getElementById('description').value.trim();
  const categoryId = document.getElementById('category').value;
  const cost = document.getElementById('cost').value;
  const tags = Array.from(document.querySelectorAll('.submit-tags input[type="checkbox"]:checked'))
    .map((checkbox) => checkbox.value);

  if (!title || !description || !categoryId) {
    showSubmitMessage(submitError, 'Please complete the title, description, and category fields.');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';

  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category_id', categoryId);
    if (url) formData.append('url', url);
    if (cost) formData.append('cost', cost);
    formData.append('tags', JSON.stringify(tags));
    formData.append('visibility', 'private');

    if (imageInput && imageInput.files && imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    const response = await fetch('/api/resources', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (response.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Could not submit resource.');
    }

    showSubmitMessage(submitSuccess, 'Resource submitted. It is now waiting for review.');
    window.location.href = `resource.html?id=${data.resource.resource_id}`;
  } catch (error) {
    showSubmitMessage(submitError, error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Resource';
  }
});
