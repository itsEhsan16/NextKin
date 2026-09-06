import { UploadReviewScreen } from '@/features/create';

/**
 * No params: a parsed upload yields a draft that is never committed (V2 §7.4), and a draft is not
 * a server resource to fetch by id — it lives in the import store until the user accepts rows or
 * walks away. Opened cold, the screen says so and sends the reader back to the upload step.
 */
export default function UploadReviewRoute() {
  return <UploadReviewScreen />;
}
