import { Router } from 'express';
import { setPassword, verifyCredentials } from '../users.js';

const router = Router();

router.get('/account', (req, res) => {
  res.render('account', { title: 'My account', error: null, success: null });
});

router.post('/account/password', async (req, res) => {
  const { current, password, confirm } = req.body;
  const render = (status, error, success = null) => res.status(status).render('account', { title: 'My account', error, success });
  if (!(await verifyCredentials(req.user.username, current))) return render(400, 'Your current password is incorrect.');
  if (password !== confirm) return render(400, 'The new passwords do not match.');
  try {
    await setPassword(req.user.username, password);
  } catch (err) {
    return render(400, err.message);
  }
  render(200, null, 'Your password has been changed.');
});

export default router;
