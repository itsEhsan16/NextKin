import { useServiceStatus } from '@nextkin/shared/queries';

import { http, USES_BACKEND } from '../dataSource';

const load = USES_BACKEND ? () => http.request('/health/features') : null;

/** `/health/features` on the backend (P13-02, R-09); disabled in mock mode, which has no outages. */
export const useBackendServiceStatus = () => useServiceStatus(load);
