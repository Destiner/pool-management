const fs = require('fs');
const ethers = require('ethers');

const providerEndpoint = process.env.REACT_APP_RPC_URL_1;
const provider = new ethers.providers.JsonRpcProvider(providerEndpoint);

async function validate() {
    await validateContractMetadata();
}

async function validateContractMetadata() {
    const erc20AbiFilePath = './src/abi/TestToken.json';
    const erc20AbiFile = await fs.readFileSync(erc20AbiFilePath, 'utf8');
    const erc20Abi = JSON.parse(erc20AbiFile).abi;
    const multicallAddress = '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441';
    const multicallAbiFilePath = './src/abi/Multicall.json';
    const multicallAbiFile = await fs.readFileSync(
        multicallAbiFilePath,
        'utf8'
    );
    const multicallAbi = JSON.parse(multicallAbiFile).abi;
    const multicall = new ethers.Contract(
        multicallAddress,
        multicallAbi,
        provider
    );

    const metadataFilePath = './src/deployed.json';
    const metadataFile = await fs.readFileSync(metadataFilePath, 'utf8');
    const metadata = JSON.parse(metadataFile);

    const tokens = metadata['mainnet'].tokens.filter(
        token => token.address !== 'ether'
    );
    const tokenAddresses = tokens.map(token => token.address);
    const tokenCount = tokens.length;
    const erc20Interface = new ethers.utils.Interface(erc20Abi);
    // validate decimals
    const decimalCalls = [];
    tokenAddresses.forEach(value => {
        decimalCalls.push([
            value,
            erc20Interface.functions.decimals.encode([]),
        ]);
    });
    const [, decimalResponse] = await multicall.aggregate(decimalCalls);
    for (let i = 0; i < tokenCount; i++) {
        const token = tokens[i];
        const decimalHex = decimalResponse[i];
        const decimalNumber = ethers.utils.bigNumberify(decimalHex);
        const decimals = decimalNumber.toNumber();
        const tokenDecimals = token.decimals;
        if (decimals !== tokenDecimals) {
            console.log('Wrong decimals', i);
        }
    }
    // validate symbol
    const symbolCalls = [];
    tokenAddresses.forEach(value => {
        symbolCalls.push([value, erc20Interface.functions.symbol.encode([])]);
    });
    const [, symbolResponse] = await multicall.aggregate(symbolCalls);
    for (let i = 0; i < tokenCount; i++) {
        const token = tokens[i];
        const tokenSymbol = token.symbol;
        const symbolBytes = symbolResponse[i];
        let symbol;
        if (symbolBytes.length === 66) {
            symbol = ethers.utils.parseBytes32String(symbolBytes);
        }
        if (symbolBytes.length === 194) {
            symbol = ethers.utils.parseBytes32String(
                '0x' + symbolBytes.substr(130)
            );
        }
        if (token.address === '0x9f49ed43C90A540d1cF12f6170aCE8d0B88a14E6') {
            continue;
        }
        if (symbol !== tokenSymbol) {
            console.log('Wrong symbol', tokenSymbol, symbol, token.address);
        }
    }
    // validate address (checksum)
    for (let i = 0; i < tokenCount; i++) {
        const token = tokens[i];
        const tokenAddress = token.address;
        const tokenIconAddress = token.iconAddress;
        if (tokenAddress !== ethers.utils.getAddress(tokenAddress)) {
            console.log('Address not checksummed', i, tokenAddress);
        }
        if (
            tokenIconAddress !== '' &&
            (tokenIconAddress !== ethers.utils.getAddress(tokenAddress) ||
                tokenIconAddress.toLowerCase() !== tokenAddress.toLowerCase())
        ) {
            console.log('notok', i, tokenAddress, tokenIconAddress);
        }
    }

    // validate token is erc20
    // validate coingecko price (is exists + is correct)
    // validate icon exists
}

validate();
