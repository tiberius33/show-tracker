import YearInReviewClient from './YearInReviewClient';

export function generateStaticParams() {
  return [{ userId: '_', year: '_' }];
}

export default function Page({ params }) {
  return <YearInReviewClient userId={params.userId} year={Number(params.year)} />;
}
