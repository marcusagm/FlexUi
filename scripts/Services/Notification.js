import { NotificationService } from './NotificationService.js';

export const appNotifications = new NotificationService({
    position: 'bottom-right',
    duration: 5000
});
