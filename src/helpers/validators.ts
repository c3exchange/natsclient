const regexPart = /^[0-9A-Za-z_-]{1,32}$/iu;

// -----------------------------------------------------------------------------

export const validateSubject = (subject: string, allowWildcards: boolean): boolean => {
	if (typeof subject !== 'string') {
		return false;
	}
	const parts = subject.split('.');
	for (let idx = 0; idx < parts.length; idx++) {
		if (parts[idx] == '>') {
			if ((!allowWildcards) || idx != parts.length - 1) {
				return false;
			}
		}
		else if (parts[idx] == '*') {
			if (!allowWildcards) {
				return false;
			}
		}
		else {
			if (!regexPart.test(parts[idx])) {
				return false;
			}
		}
	}
	return true;
};
