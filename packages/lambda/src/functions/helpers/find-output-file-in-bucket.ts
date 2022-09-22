import {HeadObjectCommand} from '@aws-sdk/client-s3';
import type {AwsRegion} from '../..';
import {ROLE_NAME} from '../../api/iam-validation/suggested-policy';
import type {CustomS3Credentials} from '../../shared/aws-clients';
import {getS3Client} from '../../shared/aws-clients';
import type {RenderMetadata} from '../../shared/constants';
import {getExpectedOutName} from './expected-out-name';
import {getOutputUrlFromMetadata} from './get-output-url-from-metadata';

export type OutputFileMetadata = {
	url: string;
	size: number;
	lastModified: number;
};

export const findOutputFileInBucket = async ({
	region,
	renderMetadata,
	bucketName,
	customCredentials,
}: {
	region: AwsRegion;
	renderMetadata: RenderMetadata;
	bucketName: string;
	customCredentials: CustomS3Credentials | null;
}): Promise<OutputFileMetadata | null> => {
	if (!renderMetadata) {
		throw new Error('unexpectedly did not get renderMetadata');
	}

	const {renderBucketName, key} = getExpectedOutName(
		renderMetadata,
		bucketName,
		null
	);

	try {
		const head = await getS3Client(region, customCredentials).send(
			new HeadObjectCommand({
				Bucket: renderBucketName,
				Key: key,
			})
		);
		return {
			lastModified: head.LastModified?.getTime() as number,
			size: head.ContentLength as number,
			url: getOutputUrlFromMetadata(
				renderMetadata,
				bucketName,
				customCredentials
			),
		};
	} catch (err) {
		if ((err as Error).name === 'NotFound') {
			return null;
		}

		if (
			(err as Error).message === 'UnknownError' ||
			(err as {$metadata: {httpStatusCode: number}}).$metadata
				.httpStatusCode === 403
		) {
			throw new Error(
				`Unable to access item "${key}" from bucket "${renderBucketName}" ${
					customCredentials?.endpoint
						? `(S3 Endpoint = ${customCredentials?.endpoint})`
						: ''
				}. The "${ROLE_NAME}" role must have permission for both "s3:GetObject" and "s3:ListBucket" actions.`
			);
		}

		throw err;
	}
};
