import axios from 'axios';

// https://github.com/FriendlyCaptcha/friendly-captcha-react/blob/main/src/components/Friendly-captcha/Backend/handleFCFormRequest.ts
type FCVerificationEndpoint = 'GLOBAL1' | 'EU1';

type FCVerificationProps = {
  endpoint?: FCVerificationEndpoint;
  solution: string;
  secret: string;
  sitekey: string;
};

type CaptchaResponse = {
  success: boolean;
  errors: any;
};

function FC_VERIFICATION_EP(endpoint: FCVerificationEndpoint): string {
  switch (endpoint) {
    case 'GLOBAL1':
      return 'https://api.friendlycaptcha.com/api/v1/siteverify';
    case 'EU1':
      return 'https://eu-api.friendlycaptcha.eu/api/v1/siteverify';
  }
}

async function httpPostFetcher(
  endpoint: string,
  requestBody: { solution: string; secret: string; siteKey: string },
  headers: { 'Content-Type': 'application/json'; Accept: 'application/json' },
): Promise<CaptchaResponse | null> {
  return new Promise<CaptchaResponse | null>(async (res) => {
    try {
      const { data } = await axios.post<CaptchaResponse>(
        endpoint,
        { ...requestBody },
        {
          headers: { ...headers },
        },
      );

      res(data);
    } catch (err) {
      res(null);
    }
  });
}

/**
 * Backend verification function that uses the FC verification API to check if the form from the submitted puzzle is valid
 * @param endpoint the endpoint to send the solved puzzle to for verification (default: global endpoint)
 * @param props including all necessary data for the verification. Sitekey is optional, if you want to make sure that the puzzle is generated from your expected site
 * @returns boolean depending on if the request yields a success or an error
 */
async function FCVerification({
  endpoint = 'GLOBAL1',
  ...props
}: FCVerificationProps): Promise<boolean> {
  return new Promise<boolean>(async (res) => {
    try {
      const data = await httpPostFetcher(
        FC_VERIFICATION_EP(endpoint),
        {
          solution: props.solution,
          secret: props.secret,
          siteKey: props.sitekey,
        },
        { 'Content-Type': 'application/json', Accept: 'application/json' },
      );

      if (data === null) {
        throw new Error(
          'Network error while trying to verify captcha solution',
        );
      }

      res(data.success);
    } catch (error) {
      res(false);
    }
  });
}

export { FCVerification };
