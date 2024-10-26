import chalk from 'chalk';  // Use ES module import
import Web3 from 'web3';
import axios from 'axios';
import fs from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent'; // Import https-proxy-agent

// Initialize web3 with your RPC URL
const web3 = new Web3('https://sepolia.base.org');

// Address for wstETH token
const wstETHAddress = '0x13e5fb0b6534bb22cbc59fae339dbbe0dc906871';

// Function to ensure unlimited spending for wstETH
async function ensureUnlimitedSpending(privateKey, spenderAddress) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const ownerAddress = account.address;

  // Create contract instance for wstETH
  const wstETHContract = new web3.eth.Contract(erc20Abi, wstETHAddress);

  try {
    // Check the current allowance
    const allowance = await wstETHContract.methods.allowance(ownerAddress, spenderAddress).call();
    const maxUint = web3.utils.toBN('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    if (web3.utils.toBN(allowance).lt(maxUint)) {
      console.log(chalk.yellow(`Allowance for wstETH not unlimited. Setting to unlimited`));

      // Approve unlimited spending
      const approveMethod = wstETHContract.methods.approve(spenderAddress, maxUint.toString());
      const gasEstimate = await approveMethod.estimateGas({ from: ownerAddress });
      const nonce = await web3.eth.getTransactionCount(ownerAddress);
      const tx = {
        from: ownerAddress,
        to: wstETHAddress,
        gas: gasEstimate,
        nonce: nonce,
        data: approveMethod.encodeABI(),
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      console.log(chalk.green(`Unlimited allowance set for wstETH with tx hash: ${receipt.transactionHash}`));
    } else {
      console.log(chalk.green(`Allowance for wstETH is already unlimited`));
    }
  } catch (error) {
    console.error(chalk.red(`Error setting unlimited allowance for wstETH: ${error.message}`));
  }
}

// Contract ABI for bondToken, lToken, create, and redeem functions
const contractAbi = [{"inputs":[],"name":"bondToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"enum Pool.TokenType","name":"tokenType","type":"uint8"},{"internalType":"uint256","name":"depositAmount","type":"uint256"},{"internalType":"uint256","name":"minAmount","type":"uint256"}],"name":"create","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"enum Pool.TokenType","name":"tokenType","type":"uint8"},{"internalType":"uint256","name":"depositAmount","type":"uint256"},{"internalType":"uint256","name":"minAmount","type":"uint256"}],"name":"redeem","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}];

// Contract address for the main contract
const contractAddress = '0x47129e886b44B5b8815e6471FCD7b31515d83242';  // Replace with actual contract address

// Initialize contract instance
const contract = new web3.eth.Contract(contractAbi, contractAddress);

// ERC-20 ABI for `allowance`, `approve`, and `balanceOf`
const erc20Abi = [{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}];

// Path to the private keys and proxy files
const privateKeysFilePath = './private_keys.txt';
const proxiesFilePath = './proxy.txt';

// Function to read the private keys from a text file
function readPrivateKeys() {
  try {
    const keys = fs.readFileSync(privateKeysFilePath, 'utf8')
      .split('\n')  // Split by newlines
      .map(key => key.trim())  // Trim spaces
      .filter(key => key.length === 64);  // Only keep valid keys of length 64

    if (keys.length === 0) {
      throw new Error('No valid private keys found in private_keys.txt.');
    }

    keys.forEach((key, index) => {
      if (key.length !== 64) {
        throw new Error(`Invalid private key at line ${index + 1}: Length should be 64 characters.`);
      }
    });

    return keys;
  } catch (error) {
    console.error(chalk.red('Error reading private_keys.txt:', error.message));
    process.exit(1);
  }
}

// Function to read the proxies from a text file
function readProxies() {
  try {
    const proxies = fs.readFileSync(proxiesFilePath, 'utf8')
      .split('\n')  // Split by newlines
      .filter(proxy => proxy.trim() !== '');  // Filter out empty lines
    return proxies;
  } catch (error) {
    console.error(chalk.red('Error reading proxy.txt:', error.message));
    process.exit(1);
  }
}

// Function to get the total points for a specific address
async function getUserPoints(address) {
  try {
    const response = await axios.get(`https://testnet.plaza.finance/api/user?address=${address}`);
    const points = response.data.points;

    if (points !== undefined) {
      console.log(chalk.white('Total points for ') + chalk.blue(address) + chalk.yellow(`: ${points}`));
      return points;
    } else {
      console.log(chalk.yellow(`\nNo points information found for ${address}.`));
      return 0;
    }
  } catch (error) {
    console.error(chalk.red(`\nError fetching points for ${address}: ${error.message}`));
    return 0;
  }
}


// Function to get total points for all wallets

// Function to check current public IP
async function checkCurrentIp() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    const currentIp = response.data.ip;
    console.log(chalk.green(`Current public IP is: ${currentIp}`));
    return currentIp;
  } catch (error) {
    console.error(chalk.red('Error fetching current IP:', error.message));
  }
}

// Function to check if the proxy is working and has changed the IP
async function verifyProxyConnection(proxy) {
  const originalIp = await checkCurrentIp(); // Get the original IP
  try {
    const response = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: new HttpsProxyAgent(proxy) // Use proxy to fetch IP
    });
    const proxyIp = response.data.ip;

    // Compare original IP with proxy IP
    if (originalIp !== proxyIp) {
      console.log(chalk.green(`Proxy is working! Your IP has changed from ${originalIp} to ${proxyIp}`));
    } else {
      throw new Error(`Proxy is not working. Your IP is still ${originalIp}.`);
    }
  } catch (error) {
    console.error(chalk.red('Error connecting through proxy:', error.message));
    throw new Error('Proxy connection failed, skipping further actions.');
  }
}

// Claim Faucet Function using the matched proxy
async function claimFaucet(address, proxy) {
  try {
    // Remove protocol from proxy, if present
    if (proxy.startsWith('http://')) {
      proxy = proxy.slice(7);
    } else if (proxy.startsWith('https://')) {
      proxy = proxy.slice(8);
    }

    // Tách các phần của proxy
    const [usernamePassword, hostPort] = proxy.split('@');
    const [username, password] = usernamePassword.split(':');
    const [host, port] = hostPort.split(':');

    // Cấu hình yêu cầu axios với proxy
    const response = await axios.post('https://testnet.plaza.finance/api/faucet-queue', null, {
      params: { address: address },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Content-Type': 'application/json',
      },
      // Sử dụng HttpsProxyAgent
      httpsAgent: new HttpsProxyAgent(`http://${username}:${password}@${host}:${port}`),  // Tạo Agent sử dụng proxy
    });

    console.log(chalk.green(`Faucet claim initiated for ${address}`));
    console.log(chalk.yellow('Claim Response:', response.data));
  } catch (error) {
    if (error.response && error.response.status === 429) {
      console.error(chalk.red('You can only use the faucet once per day.'));
    } else if (error.response && error.response.status === 403) {
      console.error(chalk.red('403 Forbidden: You may have hit a rate limit or are blocked.'));
      throw new Error('Proxy connection failed, skipping further actions.'); // Ném ra lỗi
    } else {
      console.error(chalk.red(`Error claiming faucet for ${address}: ${error.message}`));
      throw new Error('Proxy connection failed, skipping further actions.'); // Ném ra lỗi
    }
  }
}

// Helper function to generate random deposit amount between 0.009 and 0.01 ETH
function getRandomDepositAmount() {
  const min = 0.009;
  const max = 0.01;
  const randomEthAmount = Math.random() * (max - min) + min;
  return web3.utils.toWei(randomEthAmount.toString(), 'ether');  // Convert to Wei
}

// Function to get 50% of the token balance
async function getFiftyPercentBalance(tokenType, userAddress) {
  const tokenContractAddress = await getTokenContractAddress(tokenType);
  const tokenContract = new web3.eth.Contract(erc20Abi, tokenContractAddress);
  const balance = await tokenContract.methods.balanceOf(userAddress).call();

  return web3.utils.toBN(balance).div(web3.utils.toBN(2));  // Return half of the balance in Wei as BigNumber
}

// Function to perform either redeem or create with retry mechanism
async function performAction(action, tokenType, depositAmount, minAmount, privateKey) {
  const maxRetries = 5;  // Set max number of retries
  const retryDelayInSeconds = 30;  // Delay in seconds between retries

  let attempt = 0;
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const senderAddress = account.address;

  while (attempt < maxRetries) {
    try {
      let actionMethod;
      let tokenName = tokenType === 0 ? "Bond" : "Leverage";  // Determine token name

      if (action === 'create') {
        actionMethod = contract.methods.create(tokenType, depositAmount, minAmount);
      } else if (action === 'redeem') {
        const redeemAmount = await getFiftyPercentBalance(tokenType, senderAddress);
        if (redeemAmount.eq(web3.utils.toBN(0))) {
          console.log(chalk.red('No balance to redeem.'));
          return; // Exit if there’s nothing to redeem
        }

        actionMethod = contract.methods.redeem(tokenType, redeemAmount, minAmount);
      } else {
        throw new Error('Invalid action. Use "create" or "redeem".');
      }

      const nonce = await web3.eth.getTransactionCount(senderAddress);
      const gasEstimate = await actionMethod.estimateGas({ from: senderAddress });

      const tx = {
        from: senderAddress,
        to: contractAddress,
        gas: gasEstimate,
        nonce: nonce,
        data: actionMethod.encodeABI(),
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

      try {
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log(chalk.green(`TX success hash: ${receipt.transactionHash}`));
        return;  // Exit function if successful
      } catch (error) {
        console.error(chalk.red('Transaction failed:', error.message));
        if (error.data) {
          console.error(chalk.red('Revert reason:', web3.utils.hexToAscii(error.data)));
        }
      }

    } catch (error) {
      attempt++;
      console.error(chalk.red(`Error performing ${action} on attempt ${attempt} : ${error.message}`));

      if (attempt < maxRetries) {
        console.log(chalk.yellow(`Retrying in ${retryDelayInSeconds} seconds...`));
        await new Promise((resolve) => setTimeout(resolve, retryDelayInSeconds * 1000));  // Wait for retryDelayInSeconds seconds before retrying
      } else {
        console.error(chalk.red(`Max retries reached. Failed to perform ${action}.`));
      }
    }
  }
}

// Function to print the header
function printHeader() {
  const line = "=".repeat(50);
  const title = "Auto Daily Plaza Finance";
  const createdBy = "Plaza Finance";

  const totalWidth = 50;

  const titlePadding = Math.floor((totalWidth - title.length) / 2);
  const createdByPadding = Math.floor((totalWidth - createdBy.length) / 2);

  const centeredTitle = title.padStart(titlePadding + title.length).padEnd(totalWidth);
  const centeredCreatedBy = createdBy.padStart(createdByPadding + createdBy.length).padEnd(totalWidth);

  console.log(chalk.cyan.bold(line));
  console.log(chalk.cyan.bold(centeredTitle));
  console.log(chalk.green(centeredCreatedBy));
  console.log(chalk.cyan.bold(line));
}

// Helper function to get token contract address (bondToken or lToken)
async function getTokenContractAddress(tokenType) {
  if (tokenType === 0) {
    return await contract.methods.bondToken().call();
  } else if (tokenType === 1) {
    return await contract.methods.lToken().call();
  }
}

// Function to process wallets
async function processWallets() {
  const bondTokenType = 0;  // 0 for Bond ETH
  const leverageTokenType = 1;  // 1 for Leverage ETH
  const minAmount = web3.utils.toWei('0.001', 'ether');  // Example: 0.001 Ether

  printHeader();
  const privateKeys = readPrivateKeys();
  const proxies = readProxies();

  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i];
    const proxy = proxies[i];  // Get corresponding proxy

    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const walletAddress = account.address;

    const proxyIp = proxy.split('@')[1].split(':')[0];

    console.log(chalk.yellow(`\n=== Địa chỉ ${proxyIp} || ${chalk.blue(walletAddress)} ===`));

    try {
      // Step 1: Verify proxy connection
      console.log(chalk.cyan.bold('Verifying proxy connection...'));
      await verifyProxyConnection(proxy);

      // Step 2: Claim the faucet
      console.log(chalk.green(`Claiming faucet for ${walletAddress}...`));
      await claimFaucet(walletAddress, proxy);

      // Step 3: Ensure unlimited spending for wstETH
      await ensureUnlimitedSpending(privateKey, contractAddress);

      // Step 4: Create Bond Token with random deposit amount
      const randomBondAmount = getRandomDepositAmount();
      console.log(chalk.blue(`Creating Bond Token with amount: ${chalk.yellow(web3.utils.fromWei(randomBondAmount, 'ether'))} BOND`));
      await performAction('create', bondTokenType, randomBondAmount, minAmount, privateKey);

      // Step 5: Create Leverage Token with random deposit amount
      const randomLeverageAmount = getRandomDepositAmount();
      console.log(chalk.blue(`Creating Leverage Token with amount: ${chalk.yellow(web3.utils.fromWei(randomLeverageAmount, 'ether'))} LEV`));
      await performAction('create', leverageTokenType, randomLeverageAmount, minAmount, privateKey);

      // Step 6: Redeem 50% of Bond Token balance
      console.log(chalk.magenta('Redeeming 50% of Bond Token...'));
      await performAction('redeem', bondTokenType, randomBondAmount, minAmount, privateKey);

      // Step 7: Redeem 50% of Leverage Token balance
      console.log(chalk.magenta('Redeeming 50% of Leverage Token...'));
      await performAction('redeem', leverageTokenType, randomLeverageAmount, minAmount, privateKey);

      console.log(chalk.yellow(`=== CYCLE COMPLETE FOR WALLET: ${chalk.blue(walletAddress)} ===\n`));
      await getUserPoints(walletAddress);

    } catch (error) {
      console.error(chalk.red(error.message));
      console.log(chalk.green('Waiting for 20 seconds before moving to the next wallet...'));
      await new Promise((resolve) => setTimeout(resolve, 20 * 1000)); // Wait for 10 seconds before the next wallet
      continue; // Skip to the next wallet without doing anything further
    }

    console.log(chalk.green(`Waiting for 10 seconds before processing the next wallet...`));
    await new Promise((resolve) => setTimeout(resolve, 20 * 1000));  // Wait for 30 seconds before next wallet
  }

  console.log(chalk.green('=== ALL WALLETS PROCESSED ==='));
}

// Helper function to format the next run time
function getNextRunTime(delayInMs) {
  const nextRunDate = new Date(Date.now() + delayInMs);
  const hours = nextRunDate.getHours().toString().padStart(2, '0');
  const minutes = nextRunDate.getMinutes().toString().padStart(2, '0');
  const seconds = nextRunDate.getSeconds().toString().padStart(2, '0');
  const date = nextRunDate.getDate().toString().padStart(2, '0');
  const month = (nextRunDate.getMonth() + 1).toString().padStart(2, '0'); // Month is zero-based
  const year = nextRunDate.getFullYear();

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}

// Run the script and repeat every 6 hours
setInterval(async () => {
  console.log(chalk.cyan.bold(`Running the process at ${new Date().toLocaleString()}`));
  await processWallets();

  // Calculate and print out the next run time (6 hours later)
  const delayInMs = 6 * 60 * 60 * 1000;  // 6 hours in milliseconds
  const nextRunTime = getNextRunTime(delayInMs);
  console.log(chalk.green(`Process complete. Next run will be at ${nextRunTime}`));
}, 6 * 60 * 60 * 1000);  // 6 hours in milliseconds

// Run immediately on start
(async () => {
  console.log(chalk.cyan.bold(`Running the process at ${new Date().toLocaleString()}`));
  await processWallets();

  // Calculate and print out the next run time (6 hours later)
  const delayInMs = 6 * 60 * 60 * 1000;  // 6 hours in milliseconds
  const nextRunTime = getNextRunTime(delayInMs);
  console.log(chalk.green(`Process complete. Next run will be at ${nextRunTime}`));
})();