/**
 * Message template factory
 *
 * Provides template instances based on notification type
 */

import { IMessageTemplate, NotificationType } from '../notification.types';
import { Reminder48hTemplate, Reminder72hTemplate } from './reminder.template';
import { ConfirmationTemplate } from './confirmation.template';
import { CancellationTemplate } from './cancellation.template';
import { DoctorAlertTemplate } from './doctor-alert.template';

/**
 * Get template instance for notification type
 *
 * @param type - Notification type
 * @returns IMessageTemplate - Template instance
 * @throws Error if notification type is not supported
 */
export function getTemplate(type: NotificationType): IMessageTemplate {
  switch (type) {
    case NotificationType.REMINDER_48H:
      return new Reminder48hTemplate();
    case NotificationType.REMINDER_72H:
      return new Reminder72hTemplate();
    case NotificationType.CONFIRMATION:
      return new ConfirmationTemplate();
    case NotificationType.CANCELLATION:
      return new CancellationTemplate();
    case NotificationType.DOCTOR_ALERT:
      return new DoctorAlertTemplate();
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported notification type: ${String(exhaustiveCheck)}`);
    }
  }
}

// Export templates
export { Reminder48hTemplate, Reminder72hTemplate };
export { ConfirmationTemplate };
export { CancellationTemplate };
export { DoctorAlertTemplate };
