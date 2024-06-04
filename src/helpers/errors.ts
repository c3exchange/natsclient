export const isStreamNotFoundError = (err: any): boolean => {
	return err.api_error?.err_code === 10059;
};

export const isStreamAlreadyExistsError = (err: any): boolean => {
	return err.api_error?.err_code === 10058;
};

export const isStreamMessageNotFoundError = (err: any): boolean => {
	return err.api_error?.err_code === 10037;
};

export const isStreamConsumerNotFoundError = (err: any): boolean => {
	return err.api_error?.err_code === 10014;
};

export const isStreamConsumerAlreadyExistsError = (err: any): boolean => {
	return err.api_error?.err_code === 10013 || err.api_error?.err_code === 10105;
};
