import React, { type ReactNode } from 'react';
import type { AppProps } from 'next/app';
import withTheme from 'src/components/theme';
import '../../public/antd.min.css';
import 'src/styles/globals.css';
import { StyleProvider } from '@ant-design/cssinjs';

const App = ({ Component, pageProps }: AppProps): ReactNode => {
    return (
        <StyleProvider hashPriority="high">
            {withTheme(<Component {...pageProps} />)}
        </StyleProvider>
    );
};

export default App;
