/** The EICAR antivirus test string, assembled at run time so no flagged file ever sits on disk. */
export const eicar = () => new TextEncoder().encode(['X5O!P%@AP[4', '\\', 'PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-', 'TEST-FILE!$H+H*'].join(''));
