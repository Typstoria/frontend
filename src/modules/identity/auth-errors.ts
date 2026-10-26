import { ApiError } from '../../shared/api/client';

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: 'Неправильна електронна пошта або пароль.',
  EMAIL_NOT_VERIFIED:
    'Підтвердьте електронну пошту перед входом. Ми можемо надіслати нове посилання.',
  INVALID_OR_EXPIRED_TOKEN: 'Посилання недійсне або вже використане. Запросіть нове.',
  GOOGLE_ACCOUNT_LINK_REQUIRED:
    'Ця пошта вже має акаунт. Увійдіть з паролем, а потім прив’яжіть Google у налаштуваннях.',
  GOOGLE_ACCOUNT_LINK_CONFLICT:
    'Не вдалося прив’язати цей Google-акаунт. Оберіть акаунт із тією самою поштою.',
  GOOGLE_AUTH_NOT_CONFIGURED:
    'Вхід через Google зараз недоступний. Скористайтеся поштою та паролем.',
  GOOGLE_TOKEN_INVALID: 'Google не підтвердив вхід. Спробуйте ще раз.',
  RATE_LIMITED: 'Забагато спроб. Зачекайте хвилину й повторіть.',
  SESSION_EXPIRED: 'Сеанс закінчився. Увійдіть знову.',
  UNAUTHENTICATED: 'Сеанс більше не дійсний. Увійдіть знову.',
  VALIDATION_FAILED: 'Перевірте введені дані та спробуйте знову.',
  INVALID_RESPONSE: 'Сервер повернув некоректну відповідь. Спробуйте пізніше.',
};

export function describeAuthError(error: unknown) {
  if (error instanceof ApiError)
    return {
      message: messages[error.code] ?? 'Не вдалося виконати дію. Спробуйте пізніше.',
      code: error.code,
    };
  return {
    message: 'Не вдалося з’єднатися із сервером. Перевірте підключення та спробуйте знову.',
    code: 'NETWORK_ERROR',
  };
}
