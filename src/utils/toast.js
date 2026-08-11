export function showToast(message, duration = 3000) {
  if (typeof document === 'undefined') return;
  const containerId = 'app-toasts';
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'fixed';
    container.style.top = '1rem';
    container.style.right = '4rem';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-end';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.background = 'rgba(17,24,39,0.95)';
  toast.style.color = 'white';
  toast.style.padding = '8px 12px';
  toast.style.marginTop = '8px';
  toast.style.borderRadius = '6px';
  toast.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
  toast.style.fontSize = '14px';
  toast.style.opacity = '1';

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => {
      if (container.contains(toast)) container.removeChild(toast);
      // remove container if empty
      if (container.children.length === 0 && container.parentNode) container.parentNode.removeChild(container);
    }, 350);
  }, duration);
}

export default showToast;
